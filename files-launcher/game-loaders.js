/** Per-category HTML/JS transforms for cloaked games. */
(function (root) {
  const UNITY_FETCH_PATCH =
    "<script>(function(){var P=function(u){if(typeof u!=='string'||!/^https?:/i.test(u))return u;" +
    "if(/cpmstar|googlesyndication|doubleclick|google-analytics|facebook\\.com\\/tr/i.test(u))return u;" +
    "try{return new URL('x?u='+encodeURIComponent(u),location.href).href}catch(e){return u}};" +
    "var f=fetch;fetch=function(i,n){if(typeof i==='string')i=P(i);else if(i&&i.url)i=new Request(P(i.url),i);" +
    "return f.call(this,i,n)};var xo=XMLHttpRequest.prototype.open;" +
    "XMLHttpRequest.prototype.open=function(m,u){arguments[1]=P(u);return xo.apply(this,arguments)};" +
    "})();</script>";

  const AD_STRIP =
    /<script[^>]*(?:cpmstar|adsbygoogle|googletagmanager|imasdk\.googleapis|IronSource|pagead2\.googlesyndication)[^>]*>[\s\S]*?<\/script>/gi;

  function stripAds(html) {
    return html.replace(AD_STRIP, "").replace(AD_STRIP, "");
  }

  function cloakIframeEmbeds(html, toProxy) {
    return html.replace(
      /(<iframe[^>]*\ssrc=)(["'])(https?:\/\/[^"']+)\2/gi,
      (_, pre, q, src) => pre + q + toProxy(src) + q,
    );
  }

  function transformHtml(html, category, ctx) {
    const { toProxy, injectCompatShim, cloakExternalUrls, prepareBase } = ctx;
    let out = html;

    if (category === "unity-remote") {
      out = stripAds(out);
      out = cloakExternalUrls(out, toProxy);
      out = UNITY_FETCH_PATCH + out;
    } else if (category === "unity") {
      out = cloakExternalUrls(out, toProxy);
      out = UNITY_FETCH_PATCH + out;
    } else if (category === "iframe-embed") {
      out = cloakIframeEmbeds(out, toProxy);
      out = cloakExternalUrls(out, toProxy);
    } else if (category === "external-cdn" || category === "ruffle" || category === "construct") {
      out = cloakExternalUrls(out, toProxy);
    }

    return prepareBase(injectCompatShim(out));
  }

  function getCategory(gameId, profiles) {
    return (profiles && profiles[gameId]) || "static";
  }

  root.GameLoaders = { transformHtml, getCategory, stripAds, UNITY_FETCH_PATCH };
})(typeof self !== "undefined" ? self : globalThis);
