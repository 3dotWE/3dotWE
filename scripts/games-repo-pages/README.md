# 3.we-files GitHub Pages setup

Copy these files into the **root** of https://github.com/3dotWE/3.we-files and push to `main`:

- `CNAME` → custom domain `3wefiles.dpdns.org`
- `.nojekyll` → serve WASM and other non-HTML assets correctly

## GitHub Pages (games repo)

1. Repo **Settings → Pages**
2. Source: branch **main**, folder **/ (root)**
3. Custom domain: **3wefiles.dpdns.org**
4. Enable **Enforce HTTPS** when available

## DNS (DigitalPlat + Cloudflare)

If the domain uses Cloudflare nameservers:

| Type  | Name | Content              | Proxy        |
|-------|------|----------------------|--------------|
| CNAME | `@`  | `3dotwe.github.io`   | DNS only (grey cloud) |

GitHub username/org for Pages is usually lowercase: **3dotwe.github.io**.

Use your real GitHub Pages host if different (repo Pages URL shows the target).

For apex `3wefiles.dpdns.org`, GitHub may also require **A** records — see GitHub Docs “Managing a custom domain for GitHub Pages”.

## HTTPS certificate (required)

Browsers show **Not secure** if the cert is for `*.github.io` instead of `3wefiles.dpdns.org`.

1. In **3.we-files** → Settings → Pages, set custom domain `3wefiles.dpdns.org` and wait until GitHub shows **Certificate provisioned** (DNS correct).
2. DNS: CNAME `@` → `3dotwe.github.io` (grey cloud if using Cloudflare).
3. Test: `https://3wefiles.dpdns.org` — padlock should be valid, not a name mismatch.
4. Then in `files-launcher/cloak-config.js` set `GAMES_SITE_HTTPS_OK = true` and bump `SW_VERSION`.

Until then, games load via **jsDelivr** (`cdn.jsdelivr.net/gh/3dotWE/3.we-files@main/`) automatically.

## Verify

```text
https://3wefiles.dpdns.org/2048/index.html
https://3wefiles.dpdns.org/js/main.js
```

## Main site connection

The launcher in **3dotWE/3.we** reads `files-launcher/cloak-config.js`:

- Primary mirror: `https://3wefiles.dpdns.org/`
- Fallback: jsDelivr for `3dotWE/3.we-files`, then ShadowDevLabs/files

Deploy **3.we** after changing cloak config so visitors pick up SW version **7**.
