/** CDN mirror chain for game assets — avoids blocked hosts like githack. */
(function (global) {
  const REPO = atob("U2hhZG93RGV2TGFicy9maWxlcw=="); // ShadowDevLabs/files
  const BRANCH = "main";

  const MIRRORS = [
    (id) => `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${id}/index.html`,
    (id) => `https://fastly.jsdelivr.net/gh/${REPO}@${BRANCH}/${id}/index.html`,
    (id) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${id}/index.html`,
    (id) => `https://${atob("cmF3Y2RuLmdpdGhhY2suY29t")}/${REPO}/${BRANCH}/${id}/index.html`,
  ];

  const cache = new Map();

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
        const hit = { url, mirror: i, label: mirrorLabel(i) };
        cache.set(id, hit);
        return hit;
      }
    }

    const fallback = { url: MIRRORS[0](id), mirror: 0, label: mirrorLabel(0) };
    cache.set(id, fallback);
    return fallback;
  }

  function mirrorLabel(index) {
    return ["jsdelivr", "fastly", "github", "backup"][index] || "mirror";
  }

  function cloakPlayUrl(id) {
    return new URL("play.html?g=" + encodeURIComponent(id), location.href).href;
  }

  global.FilesCloak = { resolveGameUrl, cloakPlayUrl, mirrorLabel };
})(typeof window !== "undefined" ? window : globalThis);
