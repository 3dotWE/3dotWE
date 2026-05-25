importScripts("cloak-config.js");
importScripts("game-profiles.js");
importScripts("game-loaders.js");

const PREFIX = new URL("./c/", self.location.href).pathname;
const CLOAK_ROOT = PREFIX.replace(/\/c\/?$/, "/");
const LOCAL_FILES_BASE = new URL(CloakConfig.LOCAL_FILES_BASE || "../files/", self.location.href);
const { REPO, OWN_REPO, MIRROR_BASES, MIME, patchSource, rewriteUnityJson, cloakExternalUrls } = CloakConfig;

function normalizeCloakPath(path) {
  const parts = path.split("/").filter((p) => p && p !== ".");
  if (parts.some((p) => p === "..")) return null;
  return parts.join("/");
}

function externalProxyUrl(target) {
  return CLOAK_ROOT + "x?u=" + encodeURIComponent(target);
}

function gameIdFromPath(path) {
  const seg = path.split("/")[0];
  return seg || "";
}

function prepareBaseHtml(html, path) {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  const gameBase = PREFIX + dir;
  let out = html.replace(/(\s(?:src|href)=["'])\/([^"'?#]+)/gi, `$1${PREFIX}$2`);
  if (/<base[\s>]/i.test(out)) return out;
  if (/<head[^>]*>/i.test(out)) {
    return out.replace(/<head([^>]*)>/i, `<head$1><base href="${gameBase}">`);
  }
  return `<!DOCTYPE html><html><head><base href="${gameBase}"></head><body>${out}</body></html>`;
}

function rewriteHtml(html, path) {
  const id = gameIdFromPath(path);
  const category = GameLoaders.getCategory(id, GAME_PROFILES);
  const ctx = {
    toProxy: externalProxyUrl,
    injectCompatShim: CloakConfig.injectCompatShim,
    cloakExternalUrls: (t, p) => cloakExternalUrls(t, p),
    prepareBase: (h) => prepareBaseHtml(h, path),
  };
  return GameLoaders.transformHtml(html, category, ctx);
}

function patchJs(text, path) {
  const id = gameIdFromPath(path);
  const cat = GameLoaders.getCategory(id, GAME_PROFILES);
  let out = patchSource(text);
  out = cloakExternalUrls(out, externalProxyUrl);
  if (cat === "unity-remote" || cat === "unity") {
    out = GameLoaders.UNITY_FETCH_PATCH + out;
  }
  return out;
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/x") && url.searchParams.has("u")) {
    e.respondWith(handleExternal(url.searchParams.get("u")));
    return;
  }

  if (url.pathname.startsWith(PREFIX)) {
    e.respondWith(handleCloak(url.pathname.slice(PREFIX.length), url.search));
  }
});

function ext(path) {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i).toLowerCase();
}

function mime(path, header) {
  const orig = (header || "").split(";")[0].trim().toLowerCase();
  if (orig && orig !== "text/plain") return header || "application/octet-stream";
  return MIME[ext(path)] || header || "application/octet-stream";
}

async function fetchLocal(path) {
  const safe = normalizeCloakPath(path);
  if (!safe) return null;
  try {
    const res = await fetch(new URL(safe, LOCAL_FILES_BASE), { cache: "no-store" });
    if (res.ok) return res;
  } catch {
    /* no local clone */
  }
  return null;
}

async function fetchMirror(path) {
  for (const base of MIRROR_BASES) {
    try {
      const res = await fetch(base + path, { mode: "cors", cache: "no-store" });
      if (res.ok) return res;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchGitHubApiRepo(repo, path) {
  const api = `https://api.github.com/repos/${repo}/contents/${path}`;
  const res = await fetch(api, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.content) return null;
  const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
  return new Response(bytes, { status: 200, headers: { "content-type": mime(path) } });
}

async function fetchGitHubApi(path) {
  if (OWN_REPO) {
    const own = await fetchGitHubApiRepo(OWN_REPO, path);
    if (own) return own;
  }
  return fetchGitHubApiRepo(REPO, path);
}

async function handleExternal(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return new Response("Invalid external URL", { status: 400 });
  }

  try {
    const res = await fetch(parsed.href, { cache: "no-store", redirect: "follow" });
    const path = parsed.pathname + parsed.search;
    const type = mime(path, res.headers.get("content-type"));
    let body = res.body;

    if (/webgl\.json|\.json$/i.test(path) && (type.includes("json") || type.includes("text"))) {
      let text = await res.text();
      text = rewriteUnityJson(text, parsed.href, externalProxyUrl);
      return new Response(text, {
        status: res.status,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }

    if (/\.html?$/i.test(path) || type.includes("html")) {
      let html = await res.text();
      html = cloakExternalUrls(html, externalProxyUrl);
      html = CloakConfig.injectCompatShim(html);
      return new Response(html, {
        status: res.status,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const headers = new Headers();
    headers.set("content-type", type);
    headers.set("cache-control", "no-store");
    return new Response(body, { status: res.status, headers });
  } catch (err) {
    return new Response("External fetch failed: " + err.message, { status: 502 });
  }
}

async function handleCloak(path) {
  if (!path) path = "index.html";
  path = normalizeCloakPath(path) || path;

  const local = await fetchLocal(path);
  if (local) {
    const type = mime(path, local.headers.get("content-type"));
    if (path.endsWith(".html") || path.endsWith(".htm")) {
      const html = rewriteHtml(await local.text(), path);
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (path.endsWith(".js") || path.endsWith(".mjs")) {
      const js = patchJs(await local.text(), path);
      return new Response(js, {
        status: local.status,
        headers: { "content-type": type, "cache-control": "no-store" },
      });
    }
    const headers = new Headers(local.headers);
    headers.set("content-type", type);
    headers.set("cache-control", "no-store");
    return new Response(local.body, { status: local.status, headers });
  }

  const mirror = await fetchMirror(path);
  if (mirror) {
    const type = mime(path, mirror.headers.get("content-type"));
    if (path.endsWith(".html") || path.endsWith(".htm")) {
      const html = rewriteHtml(await mirror.text(), path);
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (path.endsWith(".js") || path.endsWith(".mjs")) {
      const js = patchJs(await mirror.text(), path);
      return new Response(js, {
        status: mirror.status,
        headers: { "content-type": type, "cache-control": "no-store" },
      });
    }
    const headers = new Headers(mirror.headers);
    headers.set("content-type", type);
    headers.set("cache-control", "no-store");
    return new Response(mirror.body, { status: mirror.status, headers });
  }

  const api = await fetchGitHubApi(path);
  if (api) {
    if (path.endsWith(".html") || path.endsWith(".htm")) {
      const html = rewriteHtml(await api.text(), path);
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (path.endsWith(".js") || path.endsWith(".mjs")) {
      const js = patchJs(await api.text(), path);
      return new Response(js, {
        status: 200,
        headers: { "content-type": mime(path), "cache-control": "no-store" },
      });
    }
    return api;
  }

  return new Response("All cloaked mirrors failed for " + path, { status: 502 });
}
