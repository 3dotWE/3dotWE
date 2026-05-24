/** Game loader — local files/ or Githack CDN on live site. */
(function (global) {
  const { GITHACK_BASE } = CloakConfig;
  const profiles = typeof GAME_PROFILES !== "undefined" ? GAME_PROFILES : {};

  function getCategory(id) {
    if (profiles[id]) return profiles[id];
    return "static";
  }

  function categoryLabel(id) {
    return getCategory(id).replace(/-/g, " ");
  }

  function githackGameUrl(id) {
    return GITHACK_BASE + "/" + id + "/index.html";
  }

  function cloakPlayUrl(id) {
    return githackGameUrl(id);
  }

  function frameAllows() {
    return "fullscreen; autoplay; encrypted-media; gamepad; pointer-lock; clipboard-read; clipboard-write";
  }

  /** Remove old cloak service workers so they do not intercept Githack loads. */
  async function disableServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
  }

  async function loadGameIntoFrame(frame, id) {
    const url = githackGameUrl(id);
    frame.removeAttribute("srcdoc");
    frame.setAttribute("allow", frameAllows());

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Githack load timeout")), 45000);
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

  global.FilesCloak = {
    githackGameUrl,
    cloakPlayUrl,
    getCategory,
    categoryLabel,
    disableServiceWorker,
    loadGameIntoFrame,
    profiles,
  };
})(typeof window !== "undefined" ? window : globalThis);
