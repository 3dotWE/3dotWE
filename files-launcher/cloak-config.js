/** Shared mirror config for cloak client + service worker. */
(function (root) {
  const REPO = atob("U2hhZG93RGV2TGFicy9maWxlcw==");
  const BRANCH = "main";
  const GITHACK = atob("cmF3Y2RuLmdpdGhhY2suY29t");

  const MIRROR_BASES = [
    `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
    `https://fastly.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
    `https://cdn.statically.io/gh/${REPO}@${BRANCH}/`,
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`,
    `https://${GITHACK}/${REPO}/${BRANCH}/`,
  ];

  const MIRROR_LABELS = ["jsdelivr", "fastly", "statically", "github", "backup"];

  const MIME = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".wasm": "application/wasm",
    ".data": "application/octet-stream",
    ".unityweb": "application/javascript",
    ".mem": "application/octet-stream",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
  };

  const COMPAT_SHIM =
    '<script>typeof consolelog=="undefined"&&(window.consolelog=console.log.bind(console));</script>';

  function patchSource(text) {
    if (!/\bconsolelog\b/.test(text)) return text;
    return text.replace(/\bconsolelog\b/g, "console.log");
  }

  function injectCompatShim(html) {
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${COMPAT_SHIM}`);
    }
    return COMPAT_SHIM + html;
  }

  function shouldCloakExternal(url) {
    return /digitaloceanspaces|webgl\.json|\.wasm|\.data|\.unityweb|\/build\/|\/ci\//i.test(url);
  }

  function cloakExternalUrls(text, toProxy) {
    return text.replace(/https?:\/\/[^\s"'<>\\]+/gi, (url) => {
      if (/cpmstar|google-analytics|googlesyndication|doubleclick|facebook|gstatic\.com\/analytics/i.test(url)) {
        return url;
      }
      if (shouldCloakExternal(url)) return toProxy(url);
      return url;
    });
  }

  root.CloakConfig = {
    REPO,
    BRANCH,
    MIRROR_BASES,
    MIRROR_LABELS,
    MIME,
    CLOAK_ROUTE: "c",
    EXTERNAL_ROUTE: "x",
    COMPAT_SHIM,
    patchSource,
    injectCompatShim,
    shouldCloakExternal,
    cloakExternalUrls,
  };
})(typeof self !== "undefined" ? self : window);
