/** Shared mirror config for cloak client + service worker. */
(function (root) {
  const REPO = atob("U2hhZG93RGV2TGFicy9maWxlcw==");
  const OWN_REPO = "3dotWE/3.we-files";
  const BRANCH = "main";
  const GAMES_SITE = "https://3wefiles.dpdns.org/";
  /** Set true after GitHub Pages issues a cert for 3wefiles.dpdns.org (not *.github.io). */
  const GAMES_SITE_HTTPS_OK = false;
  const GITHACK = atob("cmF3Y2RuLmdpdGhhY2suY29t");
  const GITHACK_BASE = `https://${GITHACK}/${REPO}/${BRANCH}`;

  /** jsDelivr first: reliable CORS for same-origin cloak SW on 3we.dpdns.org */
  const MIRROR_BASES = [
    `https://cdn.jsdelivr.net/gh/${OWN_REPO}@${BRANCH}/`,
    `https://fastly.jsdelivr.net/gh/${OWN_REPO}@${BRANCH}/`,
    GAMES_SITE,
    `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
    `https://fastly.jsdelivr.net/gh/${REPO}@${BRANCH}/`,
    `https://cdn.statically.io/gh/${REPO}@${BRANCH}/`,
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`,
    `https://${GITHACK}/${REPO}/${BRANCH}/`,
  ];

  const MIRROR_LABELS = ["jsdelivr-own", "fastly-own", "3wefiles", "jsdelivr", "fastly", "statically", "github", "backup"];

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
    ".swf": "application/x-shockwave-flash",
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

  const AD_HOST_RE =
    /cpmstar|googlesyndication|doubleclick|google-analytics|facebook\.com\/tr|googletagmanager\.com\/gtag/i;

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
    if (AD_HOST_RE.test(url)) return false;
    return /digitaloceanspaces|webgl\.json|\.wasm|\.data|\.unityweb|\.mem\b|storage\.y8|tbt\.mx|justfall|smashkarts|onebigstatic|flowlab\.io|cloudfront\.net|amazonaws\.com|browserfps\.com|arfotoarte\.com|\.cdn\.|\/ci\/|\/build\//i.test(
      url,
    );
  }

  function cloakExternalUrls(text, toProxy) {
    return text.replace(/https?:\/\/[^\s"'<>\\]+/gi, (url) => {
      if (AD_HOST_RE.test(url)) return url;
      if (shouldCloakExternal(url)) return toProxy(url);
      return url;
    });
  }

  const UNITY_JSON_KEYS = [
    "dataUrl",
    "wasmUrl",
    "frameworkUrl",
    "codeUrl",
    "symbolsUrl",
    "memoryUrl",
    "workerUrl",
  ];

  function rewriteUnityJson(text, baseUrl, toProxy) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") return text;
      const base = baseUrl.endsWith("/") ? baseUrl : baseUrl.slice(0, baseUrl.lastIndexOf("/") + 1);
      let changed = false;
      for (const key of UNITY_JSON_KEYS) {
        const val = data[key];
        if (typeof val !== "string") continue;
        const abs = /^https?:/i.test(val) ? val : base + val.replace(/^\//, "");
        if (val !== abs || shouldCloakExternal(abs)) {
          data[key] = toProxy(abs);
          changed = true;
        }
      }
      return changed ? JSON.stringify(data) : text;
    } catch {
      return text;
    }
  }

  root.CloakConfig = {
    REPO,
    OWN_REPO,
    GAMES_SITE,
    GAMES_SITE_HTTPS_OK,
    BRANCH,
    MIRROR_BASES,
    MIRROR_LABELS,
    MIME,
    CLOAK_ROUTE: "c",
    EXTERNAL_ROUTE: "x",
    SW_VERSION: "10",
    LOCAL_FILES_BASE: "../files/",
    GITHACK_BASE,
    COMPAT_SHIM,
    patchSource,
    injectCompatShim,
    shouldCloakExternal,
    cloakExternalUrls,
    rewriteUnityJson,
    UNITY_JSON_KEYS,
    AD_HOST_RE,
  };
})(typeof self !== "undefined" ? self : globalThis);
