/** Cloaked game loader — same-origin SW proxy + multi-mirror srcdoc fallback. */
(function (global) {
  const { REPO, MIRROR_BASES, MIRROR_LABELS, CLOAK_ROUTE, injectCompatShim, patchSource } = CloakConfig;

  const MIRRORS = MIRROR_BASES.map((base) => (id) => base + id + "/index.html");
  const cache = new Map();
  let swReady = null;

  function mirrorLabel(index) {
    return MIRROR_LABELS[index] || "mirror";
  }

  function cloakAssetUrl(path) {
    return new URL(CLOAK_ROUTE + "/" + path.replace(/^\//, ""), location.href).href;
  }

  function cloakPlayUrl(id) {
    return new URL("play.html?g=" + encodeURIComponent(id), location.href).href;
  }

  function gameBase(index, id) {
    return MIRROR_BASES[index] + id + "/";
  }

  function cloakRootUrl() {
    return new URL(CLOAK_ROUTE + "/", location.href).href;
  }

  function prepareHtml(html, gameBaseHref, repoBaseHref) {
    let out = html.replace(/(\s(?:src|href)=["'])\/([^"'?#]+)/gi, `$1${repoBaseHref}$2`);
    if (/<base[\s>]/i.test(out)) return injectCompatShim(out);
    if (/<head[^>]*>/i.test(out)) {
      return out.replace(
        /<head([^>]*)>/i,
        `<head$1>${CloakConfig.COMPAT_SHIM}<base href="${gameBaseHref}">`,
      );
    }
    return `<!DOCTYPE html><html><head>${CloakConfig.COMPAT_SHIM}<base href="${gameBaseHref}"></head><body>${out}</body></html>`;
  }

  function prepareHtmlCloaked(html, id) {
    const gameBase = cloakAssetUrl(id + "/");
    const repoBase = cloakRootUrl();
    return prepareHtml(html, gameBase, repoBase);
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) return false;
    if (swReady) return swReady;
    swReady = (async () => {
      try {
        await navigator.serviceWorker.register(new URL("cloak-sw.js", location.href), { scope: "./" });
        await navigator.serviceWorker.ready;
        return true;
      } catch {
        swReady = null;
        return false;
      }
    })();
    return swReady;
  }

  async function probe(url) {
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store", mode: "cors" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function resolveGameUrl(id) {
    if (cache.has(id)) return cache.get(id);

    for (let i = 0; i < MIRRORS.length; i++) {
      const url = MIRRORS[i](id);
      if (await probe(url)) {
        const hit = { url, mirror: i, label: mirrorLabel(i), base: MIRROR_BASES[i] };
        cache.set(id, hit);
        return hit;
      }
    }

    const fallback = { url: MIRRORS[0](id), mirror: 0, label: mirrorLabel(0), base: MIRROR_BASES[0] };
    cache.set(id, fallback);
    return fallback;
  }

  async function fetchHtmlFromMirror(id, mirrorIndex) {
    const url = MIRRORS[mirrorIndex](id);
    const res = await fetch(url, { cache: "no-store", mode: "cors" });
    if (!res.ok) throw new Error("mirror " + mirrorLabel(mirrorIndex) + " (" + res.status + ")");
    return { html: await res.text(), mirror: mirrorIndex, label: mirrorLabel(mirrorIndex), url };
  }

  async function fetchHtmlFromGitHubApi(id) {
    const path = id + "/index.html";
    const res = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + path, { cache: "no-store" });
    if (!res.ok) throw new Error("github api (" + res.status + ")");
    const data = await res.json();
    if (!data || !data.content) throw new Error("github api empty");
    const html = atob(data.content.replace(/\n/g, ""));
    return { html, mirror: -1, label: "github-api", url: "github-api://" + path };
  }

  function applySrcdoc(frame, html, id, useCloakRoutes) {
    frame.removeAttribute("src");
    if (useCloakRoutes) {
      frame.srcdoc = prepareHtmlCloaked(html, id);
      return;
    }
    frame.srcdoc = prepareHtml(html, gameBase(0, id), MIRROR_BASES[0]);
  }

  async function loadViaServiceWorker(frame, id) {
    const url = cloakAssetUrl(id + "/index.html");
    frame.removeAttribute("srcdoc");
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("cloak timeout")), 15000);
      frame.onload = () => {
        clearTimeout(timer);
        try {
          const doc = frame.contentDocument;
          const text = doc && doc.body ? doc.body.innerText || "" : "";
          if (/all cloaked mirrors failed/i.test(text)) {
            reject(new Error("cloak mirrors failed"));
            return;
          }
        } catch {
          /* cross-origin shouldn't happen on cloak route */
        }
        resolve();
      };
      frame.onerror = () => {
        clearTimeout(timer);
        reject(new Error("cloak frame error"));
      };
      frame.src = url;
    });
    return { label: "same-origin", url, mode: "cloak-sw" };
  }

  async function loadViaSrcdocFallback(frame, id, useCloakRoutes) {
    const order = [...MIRRORS.keys()];
    let lastErr = null;
    for (const i of order) {
      try {
        const hit = await fetchHtmlFromMirror(id, i);
        if (useCloakRoutes) {
          applySrcdoc(frame, hit.html, id, true);
        } else {
          frame.removeAttribute("src");
          frame.srcdoc = prepareHtml(hit.html, gameBase(i, id), MIRROR_BASES[i]);
        }
        return { label: hit.label, url: cloakPlayUrl(id), mode: "srcdoc" };
      } catch (err) {
        lastErr = err;
      }
    }
    try {
      const hit = await fetchHtmlFromGitHubApi(id);
      applySrcdoc(frame, hit.html, id, useCloakRoutes);
      return { label: hit.label, url: cloakPlayUrl(id), mode: "srcdoc-api" };
    } catch (err) {
      lastErr = err;
    }
    throw lastErr || new Error("All cloaked fallbacks failed");
  }

  /** Load game with SW cloak first, then mirror/srcdoc/API fallbacks. */
  async function loadGameIntoFrame(frame, id) {
    const swActive = await ensureServiceWorker();
    if (swActive) {
      try {
        return await loadViaServiceWorker(frame, id);
      } catch {
        /* fall through to srcdoc chain */
      }
    }
    return loadViaSrcdocFallback(frame, id, swActive);
  }

  global.FilesCloak = {
    resolveGameUrl,
    cloakPlayUrl,
    cloakAssetUrl,
    mirrorLabel,
    ensureServiceWorker,
    loadGameIntoFrame,
  };
})(typeof window !== "undefined" ? window : globalThis);
