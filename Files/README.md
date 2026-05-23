# Files game library

Games load from a CDN by default. For best results, **download games in chunks** and host them locally.

## Why CDN iframes showed source code

jsDelivr often serves `.html` as plain text in iframes. We use **githack** for remote play, and **local copies** for reliable hosting on your site.

## Download games in chunks (recommended)

From the repo root:

```bash
chmod +x scripts/pull-files-chunk.sh
./scripts/pull-files-chunk.sh 2048 among-us slope 1v1lol
```

This only downloads the folders you name (not the entire 4GB repo).

Games are copied to `Files/games/<name>/`. The launcher prefers local copies when present.

## Full repo (not recommended for GitHub Pages)

The upstream repo is ~4GB. GitHub Pages cannot host all of it. Use chunks of games you actually want.

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/ShadowDevLabs/files.git
cd files
git sparse-checkout set game1 game2
```
