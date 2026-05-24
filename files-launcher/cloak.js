/** Cloaked game loader — profile-based strategies + SW proxy. */
(function (global) {
  const { REPO, MIRROR_BASES, MIRROR_LABELS, CLOAK_ROUTE, injectCompatShim, patchSource, cloakExternalUrls } =
    CloakConfig;

  const profiles = typeof GAME_PROFILES !== "undefined" ? GAME_PROFILES : {};
  const SW_VERSION_KEY = "files-cloak:sw-version";

  function externalProxyUrl(target) {
    return new URL("x?u=" + encodeURIComponent(target), location.href).href;
  }

  const MIRRORS = MIRROR_BASES.map((base) => (id) => base + id + "/index.html");
  const cache = new Map();
  let swReady = null;

  function getCategory(id) {
    return GameLoaders.getCategory(id, profiles);
  }

  function categoryLabel(id) {
    return getCategory(id).replace("-", " ");
  }

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

  function prepareHtmlForGame(html, id, repoBaseHref) {
    const gameBase = cloakAssetUrl(id + "/");
    const ctx = {
      toProxy: externalProxyUrl,
      injectCompatShim,
      cloakExternalUrls,
      prepareBase: (h) => {
        let out = h.replace(/(\s(?:src|href)=["'])\/([^"'?#]+)/gi, `$1${repoBaseHref}$2`);
        if (/<base[\s>]/i.test(out)) return injectCompatShim(out);
        if (/<head[^>]*>/i.test(out)) {
          return out.replace(/<head([^>]*)>/i, `<head$1>${CloakConfig.COMPAT_SHIM}<base href="${gameBase}">`);
        }
        return `<!DOCTYPE html><html><head>${CloakConfig.COMPAT_SHIM}<base href="${gameBase}"></head><body>${out}</body></html>`;
      },
    };
    return GameLoaders.transformHtml(html, getCategory(id), ctx);
  }

  function prepareHtmlCloaked(html, id) {
    return prepareHtmlForGame(html, id, cloakRootUrl());
  }

  /** Unregister stale workers when cloak version changes (runs in your browser on load). */
  async function resetStaleServiceWorkers() {
    if (!("serviceWorker" in navigator)) return false;
    const want = CloakConfig.SW_VERSION;
    let had = localStorage.getItem(SW_VERSION_KEY);
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const scope = new URL("./", location.href).href;
      const ours = regs.filter((r) => r.scope === scope || r.scope === scope.replace(/\/$/, "") + "/");
      if (had === want && ours.length) return false;
      await Promise.all(regs.map((r) => r.unregister()));
      localStorage.setItem(SW_VERSION_KEY, want);
      swReady = null;
      return true;
    } catch {
      return false;
    }
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) return false;
    await resetStaleServiceWorkers();
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
        const hit = { url, mirror: i, label: mirrorLabel(i), base: MIRROR_BASES[i], category: getCategory(id) };
        cache.set(id, hit);
        return hit;
      }
    }
    const fallback = {
      url: MIRRORS[0](id),
      mirror: 0,
      label: mirrorLabel(0),
      base: MIRROR_BASES[0],
      category: getCategory(id),
    };
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
    return { html: atob(data.content.replace(/\n/g, "")), mirror: -1, label: "github-api", url: "github-api://" + path };
  }

  function applySrcdoc(frame, html, id, useCloakRoutes) {
    frame.removeAttribute("src");
    if (useCloakRoutes) {
      frame.srcdoc = prepareHtmlCloaked(html, id);
      return;
    }
    frame.srcdoc = prepareHtmlForGame(html, id, cloakRootUrl());
  }

  function frameAllows() {
    return "fullscreen; autoplay; encrypted-media; gamepad; pointer-lock; clipboard-read; clipboard-write";
  }

  async function waitForFrameLoad(frame, id, timeoutMs) {
    const cat = getCategory(id);
    const unityWait = cat === "unity-remote" ? 8000 : cat === "unity" ? 6000 : 2500;

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("cloak timeout")), timeoutMs);
      frame.onload = () => {
        clearTimeout(timer);
        setTimeout(() => {
          try {
            const doc = frame.contentDocument;
            const text = doc && doc.body ? doc.body.innerText || "" : "";
            if (/all cloaked mirrors failed/i.test(text)) {
              reject(new Error("cloak mirrors failed"));
              return;
            }
            if (cat === "iframe-embed") {
              const inner = doc && doc.querySelector("iframe");
              if (!inner) reject(new Error("embed iframe missing"));
              return;
            }
            if (cat === "unity-remote" || cat === "unity") {
              const canvas = doc && doc.querySelector("canvas");
              const gc = doc && doc.getElementById("gameContainer");
              const loader = doc && doc.getElementById("loader");
              if (gc && !canvas && loader && loader.style.display !== "none") {
                reject(new Error("unity assets did not load"));
                return;
              }
            }
          } catch {
            /* ignore */
          }
          resolve();
        }, unityWait);
      };
      frame.onerror = () => {
        clearTimeout(timer);
        reject(new Error("cloak frame error"));
      };
    });
  }

  async function loadViaServiceWorker(frame, id) {
    const url = cloakAssetUrl(id + "/index.html");
    frame.removeAttribute("srcdoc");
    frame.setAttribute("allow", frameAllows());
    await waitForFrameLoad(frame, id, 25000);
    return { label: "same-origin · " + categoryLabel(id), url, mode: "cloak-sw", category: getCategory(id) };
  }

  async function loadViaSrcdocFallback(frame, id, useCloakRoutes) {
    const order = [...MIRRORS.keys()];
    let lastErr = null;
    for (const i of order) {
      try {
        const hit = await fetchHtmlFromMirror(id, i);
        applySrcdoc(frame, hit.html, id, useCloakRoutes);
        return { label: hit.label + " · " + categoryLabel(id), url: cloakPlayUrl(id), mode: "srcdoc", category: getCategory(id) };
      } catch (err) {
        lastErr = err;
      }
    }
    try {
      const hit = await fetchHtmlFromGitHubApi(id);
      applySrcdoc(frame, hit.html, id, useCloakRoutes);
      return { label: "github-api · " + categoryLabel(id), url: cloakPlayUrl(id), mode: "srcdoc-api", category: getCategory(id) };
    } catch (err) {
      lastErr = err;
    }
    throw lastErr || new Error("All cloaked fallbacks failed");
  }

  async function loadGameIntoFrame(frame, id) {
    const cat = getCategory(id);
    const swActive = await ensureServiceWorker();
    if (swActive) {
      try {
        return await loadViaServiceWorker(frame, id);
      } catch {
        /* fall through */
      }
    }
    if (cat === "iframe-embed") {
      try {
        return await loadViaSrcdocFallback(frame, id, swActive);
      } catch {
        /* continue */
      }
    }
    return loadViaSrcdocFallback(frame, id, swActive);
  }

  global.FilesCloak = {
    resolveGameUrl,
    cloakPlayUrl,
    cloakAssetUrl,
    mirrorLabel,
    getCategory,
    categoryLabel,
    ensureServiceWorker,
    resetStaleServiceWorkers,
    loadGameIntoFrame,
    profiles,
  };
})(typeof window !== "undefined" ? window : globalThis);
