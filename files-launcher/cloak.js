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

  const MIRROR_BASES = [
    `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
    `https://fastly.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`,
    `https://${atob("cmF3Y2RuLmdpdGhhY2suY29t")}/${REPO}/${BRANCH}/`,
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
        const hit = { url, mirror: i, label: mirrorLabel(i), base: MIRROR_BASES[i] };
        cache.set(id, hit);
        return hit;
      }
    }

    const fallback = { url: MIRRORS[0](id), mirror: 0, label: mirrorLabel(0), base: MIRROR_BASES[0] };
    cache.set(id, fallback);
    return fallback;
  }

  function mirrorLabel(index) {
    return ["jsdelivr", "fastly", "github", "backup"][index] || "mirror";
  }

  function cloakPlayUrl(id) {
    return new URL("play.html?g=" + encodeURIComponent(id), location.href).href;
  }

  function gameBase(index, id) {
    return MIRROR_BASES[index] + id + "/";
  }

  function prepareHtml(html, gameBaseHref, repoBaseHref) {
    let out = html.replace(/(\s(?:src|href)=["'])\/([^"'?#]+)/gi, `$1${repoBaseHref}$2`);
    if (/<base[\s>]/i.test(out)) return out;
    if (/<head[^>]*>/i.test(out)) {
      return out.replace(/<head([^>]*)>/i, `<head$1><base href="${gameBaseHref}">`);
    }
    return `<!DOCTYPE html><html><head><base href="${gameBaseHref}"></head><body>${out}</body></html>`;
  }

  /** Fetch HTML and inject via srcdoc — fixes jsdelivr text/plain rendering. */
  async function loadGameIntoFrame(frame, id) {
    const hit = await resolveGameUrl(id);
    const res = await fetch(hit.url, { cache: "no-store", mode: "cors" });
    if (!res.ok) throw new Error("Failed to load game (" + res.status + ")");
    const html = prepareHtml(await res.text(), gameBase(hit.mirror, id), hit.base);
    frame.removeAttribute("src");
    frame.srcdoc = html;
    return hit;
  }

  global.FilesCloak = { resolveGameUrl, cloakPlayUrl, mirrorLabel, loadGameIntoFrame };
})(typeof window !== "undefined" ? window : globalThis);
