# Deploy Astro (required for static sites like GitHub Pages)

Astro is a **web proxy** and needs a **Node.js server** for `/bare/`, `/uv/`, and `/dynamic/`.
It cannot run from a static host alone.

## Free deploy on Render (recommended)

**Full guide:** see `RENDER-SETUP.md` in the repo root.

**Quick deploy:** https://render.com/deploy?repo=https://github.com/3dotWE/3.we

1. Sign in to Render with GitHub.
2. Open the link above and apply the blueprint.
3. When **Live**, copy your URL (e.g. `https://3we-astro.onrender.com`).

## Connect the compiler site

Edit `astro-config.json` in the repo root:

```json
{
  "url": "https://your-astro-app.onrender.com"
}
```

Commit and push. Then `run Astro` on your static site will open the hosted proxy.

Or on any device, in the compiler terminal:

```
astro https://your-astro-app.onrender.com
run Astro
```

## Local use (same computer / Wi‑Fi)

```bash
cd Astro/Astro
npm install
npm start
```

Then `run Astro` or `astro http://YOUR-LAN-IP:8080` on other devices.
