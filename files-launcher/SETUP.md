# Launcher ↔ games site wiring

| Site | Repo | Role |
|------|------|------|
| [3we.dpdns.org](https://3we.dpdns.org/) | [3dotWE/3.we](https://github.com/3dotWE/3.we) | Terminal + **files-launcher** (cloak) |
| [3wefiles.dpdns.org](http://3wefiles.dpdns.org/) | [3dotWE/3.we-files](https://github.com/3dotWE/3.we-files) | Raw game files at repo root |

## How loads work

1. **Simple games** (`static`, `phaser`) → iframe `https://3wefiles.dpdns.org/<game>/index.html` when the games site is up (fixes `/js/main.js` on that host).
2. **Everything else** → same-origin **cloak** on `3we.dpdns.org/files-launcher/c/...` via service worker.
3. **Mirror order** (SW / srcdoc): jsDelivr `3dotWE/3.we-files` → `3wefiles.dpdns.org` → ShadowDevLabs fallbacks.
4. **External assets** (Unity WASM, embeds) → proxied through `files-launcher/x?u=...` on your domain.

## Games repo checklist

- [ ] Root contains `CNAME` with `3wefiles.dpdns.org`
- [ ] Root contains `.nojekyll`
- [ ] GitHub Pages: branch `main`, folder `/`
- [ ] Custom domain + HTTPS enabled
- [ ] `https://3wefiles.dpdns.org/2048/index.html` returns 200
- [ ] `https://3wefiles.dpdns.org/js/main.js` returns 200

## Deploy main repo

After changing `cloak-config.js`, push **3.we** and hard-refresh the launcher once (SW version bumps automatically).

## Sync game list from GitHub

```bash
python3 scripts/sync-manifest-from-github.py
```

## Verify from terminal site

On [3we.dpdns.org](https://3we.dpdns.org/), run: `run files`
