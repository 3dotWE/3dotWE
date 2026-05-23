# Deploy Astro on Render (step-by-step)

Your static site (GitHub Pages) cannot run the Astro proxy. Deploy Astro to Render (free), then link it in `astro-config.json`.

## Step 1 — Push is already on GitHub

Repo: **https://github.com/3dotWE/3.we**

## Step 2 — Create a Render account

1. Open **https://render.com**
2. Click **Get Started** and sign up with **GitHub**
3. Allow Render to access your repositories

## Step 3 — Deploy with Blueprint (easiest)

1. Open this link (one-click deploy):

   **https://render.com/deploy?repo=https://github.com/3dotWE/3.we**

2. Click **Apply** / **Create Web Service**
3. Wait for the build (about 2–5 minutes). Status should become **Live**.

4. Copy your service URL, e.g. `https://3we-astro.onrender.com`

> **Free tier:** The app sleeps after ~15 minutes idle. First visit may take 30–60 seconds to wake up.

## Step 3 (alternate) — Manual deploy

If the blueprint link does not work:

1. Render dashboard → **New +** → **Web Service**
2. Connect **3dotWE/3.we**
3. Settings:
   - **Name:** `3we-astro`
   - **Root Directory:** `Astro/Astro`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. **Create Web Service** and wait until **Live**

## Step 4 — Connect your static compiler site

Edit `astro-config.json` in the repo root:

```json
{
  "url": "https://YOUR-SERVICE-NAME.onrender.com"
}
```

Replace with your real Render URL (no trailing slash).

Commit and push:

```bash
cd /Users/markowiita/3.we/3.we
git add astro-config.json
git commit -m "Point compiler at hosted Astro server"
git push
```

After GitHub Pages updates (1–2 min), **`run Astro`** on your site will open the hosted proxy.

## Step 5 — Test

1. Open your Render URL in the browser — you should see the Astro home page.
2. Open your compiler site → terminal → `run Astro`
3. Or run: `astro https://YOUR-SERVICE-NAME.onrender.com` then `run Astro`

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Build failed | Render logs → check `npm install` in `Astro/Astro` |
| 502 / slow first load | Free tier waking up — wait 60s and refresh |
| `run Astro` still fails on static site | Set `astro-config.json` `url` and push |
| Proxy errors | Confirm service is **Live** on Render |
