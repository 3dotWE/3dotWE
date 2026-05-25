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
