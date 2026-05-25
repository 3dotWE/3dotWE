/** Cloaked game loader — profile-based strategies + SW proxy. */
(function (global) {
  const {
    REPO,
    OWN_REPO,
    GAMES_SITE,
    MIRROR_BASES,
    MIRROR_LABELS,
    CLOAK_ROUTE,
    GITHACK_BASE,
    injectCompatShim,
    patchSource,
    cloakExternalUrls,
    GAMES_SITE_HTTPS_OK,
  } = CloakConfig;

  const PROXY_CATEGORIES = new Set(["unity-remote", "unity", "external-cdn", "iframe-embed", "construct"]);

  const profiles = typeof GAME_PROFILES !== "undefined" ? GAME_PROFILES : {};
  const SW_VERSION_KEY = "files-cloak:sw-version";

  function externalProxyUrl(target) {
    return new URL("x?u=" + encodeURIComponent(target), location.href).href;
  }

  let activeMirrorBases = null;
  let activeMirrors = null;
  const cache = new Map();
  let swReady = null;
  let gamesSiteOk = null;

  function labelForBase(base) {
    const i = MIRROR_BASES.indexOf(base);
    return mirrorLabel(i >= 0 ? i : 0);
  }

  async function ensureActiveMirrors() {
    if (activeMirrorBases) return activeMirrorBases;
    const bases = [...MIRROR_BASES];
    if (!GAMES_SITE_HTTPS_OK) {
      for (let i = bases.length - 1; i >= 0; i--) {
        if (bases[i] === GAMES_SITE) bases.splice(i, 1);
      }
      gamesSiteOk = false;
    }
    activeMirrorBases = bases;
    activeMirrors = bases.map((base) => (id) => base + id + "/index.html");
    return activeMirrorBases;
  }

  const DIRECT_GAMES_SITE_CATEGORIES = new Set(["static", "phaser"]);

  function gamesSiteGameUrl(id) {
    return GAMES_SITE + id.replace(/^\//, "") + "/index.html";
  }

  function canUseGamesSiteDirect(cat) {
    return DIRECT_GAMES_SITE_CATEGORIES.has(cat);
  }

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

  function githackGameUrl(id) {
    return GITHACK_BASE + "/" + id + "/index.html";
  }

  function needsProxy(id) {
    return PROXY_CATEGORIES.has(getCategory(id));
  }

  function gameBase(index, id) {
    const bases = activeMirrorBases || MIRROR_BASES;
    return bases[index] + id + "/";
  }

  function cloakRootUrl() {
    return new URL(CLOAK_ROUTE + "/", location.href).href;
  }

  function isErrorPageHtml(html) {
    return /There isn't a GitHub Pages site|File not found|404: Not Found|Page not found/i.test(html);
  }

  function prepareHtmlForGame(html, id, repoBaseHref, assetBaseHref) {
    const gameBase = assetBaseHref || cloakAssetUrl(id + "/");
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

  async function probeGamesSite() {
    if (!GAMES_SITE_HTTPS_OK && gamesSiteOk === false) return false;
    if (gamesSiteOk !== null) return gamesSiteOk;
    gamesSiteOk = await probe(GAMES_SITE + "js/main.js");
    if (!gamesSiteOk) gamesSiteOk = await probe(gamesSiteGameUrl("2048"));
    if (!gamesSiteOk) gamesSiteOk = false;
    return gamesSiteOk;
  }

  async function resolveGameUrl(id) {
    if (cache.has(id)) return cache.get(id);
    await ensureActiveMirrors();
    for (let i = 0; i < activeMirrors.length; i++) {
      const url = activeMirrors[i](id);
      if (await probe(url)) {
        const hit = {
          url,
          mirror: i,
          label: labelForBase(activeMirrorBases[i]),
          base: activeMirrorBases[i],
          category: getCategory(id),
        };
        cache.set(id, hit);
        return hit;
      }
    }
    const fallback = {
      url: activeMirrors[0](id),
      mirror: 0,
      label: labelForBase(activeMirrorBases[0]),
      base: activeMirrorBases[0],
      category: getCategory(id),
    };
    cache.set(id, fallback);
    return fallback;
  }

  async function fetchHtmlFromMirror(id, mirrorIndex) {
    await ensureActiveMirrors();
    const url = activeMirrors[mirrorIndex](id);
    const res = await fetch(url, { cache: "no-store", mode: "cors" });
    const label = labelForBase(activeMirrorBases[mirrorIndex]);
    if (!res.ok) throw new Error("mirror " + label + " (" + res.status + ")");
    const html = await res.text();
    if (isErrorPageHtml(html)) throw new Error("mirror " + label + " (404 page)");
    return { html, mirror: mirrorIndex, label, url, base: activeMirrorBases[mirrorIndex] };
  }

  async function fetchHtmlFromGitHubApiRepo(repo, id) {
    const path = id + "/index.html";
    const res = await fetch("https://api.github.com/repos/" + repo + "/contents/" + path, { cache: "no-store" });
    if (!res.ok) throw new Error("github api " + repo + " (" + res.status + ")");
    const data = await res.json();
    if (!data || !data.content) throw new Error("github api empty");
    return { html: atob(data.content.replace(/\n/g, "")), mirror: -1, label: "github-api", url: "github-api://" + repo + "/" + path };
  }

  async function fetchHtmlFromGitHubApi(id) {
    if (OWN_REPO) {
      try {
        return await fetchHtmlFromGitHubApiRepo(OWN_REPO, id);
      } catch {
        /* fall through */
      }
    }
    return fetchHtmlFromGitHubApiRepo(REPO, id);
  }

  function applySrcdoc(frame, html, id, useCloakRoutes, mirrorBase) {
    frame.removeAttribute("src");
    if (useCloakRoutes) {
      frame.srcdoc = prepareHtmlCloaked(html, id);
      return;
    }
    const base = mirrorBase || gameBase(0, id);
    frame.srcdoc = prepareHtmlForGame(html, id, base, base);
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
            if (isErrorPageHtml(text)) {
              reject(new Error("game not found (404)"));
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

  async function loadViaGamesSite(frame, id) {
    const url = gamesSiteGameUrl(id);
    frame.removeAttribute("srcdoc");
    frame.setAttribute("allow", frameAllows());
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("3wefiles timeout")), 45000);
      frame.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      frame.onerror = () => {
        clearTimeout(timer);
        reject(new Error("3wefiles load failed"));
      };
      frame.src = url;
    });
    return { label: "3wefiles", url, mode: "games-site", category: getCategory(id) };
  }

  async function loadViaGithack(frame, id) {
    const url = githackGameUrl(id);
    frame.removeAttribute("srcdoc");
    frame.setAttribute("allow", frameAllows());
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Githack timeout")), 45000);
      frame.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      frame.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Githack load failed"));
      };
      frame.src = url;
    });
    return { label: "githack", url, mode: "githack", category: getCategory(id) };
  }

  async function loadViaServiceWorker(frame, id) {
    const url = cloakAssetUrl(id + "/index.html");
    frame.removeAttribute("srcdoc");
    frame.setAttribute("allow", frameAllows());
    frame.src = url;
    await waitForFrameLoad(frame, id, 25000);
    return { label: "same-origin · " + categoryLabel(id), url, mode: "cloak-sw", category: getCategory(id) };
  }

  async function loadViaSrcdocFallback(frame, id, useCloakRoutes) {
    await ensureActiveMirrors();
    const order = [...activeMirrors.keys()];
    let lastErr = null;
    for (const i of order) {
      try {
        const hit = await fetchHtmlFromMirror(id, i);
        applySrcdoc(frame, hit.html, id, useCloakRoutes, hit.base);
        return { label: hit.label + " · " + categoryLabel(id), url: cloakPlayUrl(id), mode: "srcdoc", category: getCategory(id) };
      } catch (err) {
        lastErr = err;
      }
    }
    try {
      const hit = await fetchHtmlFromGitHubApi(id);
      if (isErrorPageHtml(hit.html)) throw new Error("github api (404 page)");
      const apiBase = (OWN_REPO ? `https://cdn.jsdelivr.net/gh/${OWN_REPO}@${CloakConfig.BRANCH}/` : MIRROR_BASES[0]) + id + "/";
      applySrcdoc(frame, hit.html, id, useCloakRoutes, apiBase);
      return { label: "github-api · " + categoryLabel(id), url: cloakPlayUrl(id), mode: "srcdoc-api", category: getCategory(id) };
    } catch (err) {
      lastErr = err;
    }
    throw lastErr || new Error("All cloaked fallbacks failed");
  }

  async function gameExists(id) {
    await ensureActiveMirrors();
    for (let i = 0; i < activeMirrors.length; i++) {
      if (await probe(activeMirrors[i](id))) return true;
    }
    return false;
  }

  async function loadGameIntoFrame(frame, id) {
    await ensureActiveMirrors();
    const cat = getCategory(id);
    if (!(await gameExists(id))) {
      throw new Error("Game not found on 3wefiles or mirrors: " + id);
    }
    if (GAMES_SITE_HTTPS_OK && (await probeGamesSite()) && (canUseGamesSiteDirect(cat) || cat === "iframe-embed")) {
      try {
        return await loadViaGamesSite(frame, id);
      } catch {
        /* fall through to cloak */
      }
    }
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
    try {
      return await loadViaSrcdocFallback(frame, id, swActive);
    } catch {
      /* fall through */
    }
    if (!needsProxy(id)) {
      try {
        return await loadViaGithack(frame, id);
      } catch {
        /* exhausted */
      }
    }
    throw new Error("All load paths failed");
  }

  global.FilesCloak = {
    resolveGameUrl,
    githackGameUrl,
    gamesSiteGameUrl,
    cloakPlayUrl,
    cloakAssetUrl,
    mirrorLabel,
    getCategory,
    categoryLabel,
    needsProxy,
    probeGamesSite,
    ensureServiceWorker,
    resetStaleServiceWorkers,
    loadGameIntoFrame,
    profiles,
    GAMES_SITE,
    OWN_REPO,
  };
})(typeof window !== "undefined" ? window : globalThis);
