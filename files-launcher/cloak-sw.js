importScripts("cloak-config.js");

const PREFIX = new URL("./c/", self.location.href).pathname;
const { REPO, MIRROR_BASES, MIME } = CloakConfig;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(PREFIX)) return;
  e.respondWith(handleCloak(url.pathname.slice(PREFIX.length), url.search));
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

function rewriteHtml(html, path) {
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  const gameBase = PREFIX + dir;
  let out = html.replace(/(\s(?:src|href)=["'])\/([^"'?#]+)/gi, `$1${PREFIX}$2`);
  if (/<base[\s>]/i.test(out)) return out;
  if (/<head[^>]*>/i.test(out)) {
    return out.replace(/<head([^>]*)>/i, `<head$1><base href="${gameBase}">`);
  }
  return `<!DOCTYPE html><html><head><base href="${gameBase}"></head><body>${out}</body></html>`;
}

async function fetchMirror(path) {
  let lastStatus = 502;
  for (const base of MIRROR_BASES) {
    try {
      const res = await fetch(base + path, { mode: "cors", cache: "no-store" });
      if (res.ok) return res;
      lastStatus = res.status;
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

async function fetchGitHubApi(path) {
  const api = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const res = await fetch(api, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.content) return null;
  const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
  return new Response(bytes, { status: 200, headers: { "content-type": mime(path) } });
}

async function handleCloak(path, search) {
  if (!path) path = "index.html";

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
    return api;
  }

  return new Response("All cloaked mirrors failed for " + path, { status: 502 });
}
