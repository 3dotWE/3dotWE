/** Shared config for Files launcher. */
(function (root) {
  const REPO = atob("U2hhZG93RGV2TGFicy9maWxlcw==");
  const BRANCH = "main";
  const GITHACK = atob("cmF3Y2RuLmdpdGhhY2suY29t");

  const GITHACK_BASE = `https://${GITHACK}/${REPO}/${BRANCH}`;

  const COMPAT_SHIM =
    '<script>typeof consolelog=="undefined"&&(window.consolelog=console.log.bind(console));</script>';

  function patchSource(text) {
    if (!/\bconsolelog\b/.test(text)) return text;
    return text.replace(/\bconsolelog\b/g, "console.log");
  }

  root.CloakConfig = { REPO, BRANCH, GITHACK_BASE, COMPAT_SHIM, patchSource };
})(typeof self !== "undefined" ? self : globalThis);
