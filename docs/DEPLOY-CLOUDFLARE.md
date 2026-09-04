# Deploying to Cloudflare Pages — `riichi.churi.net`

This app is a fully static Vite build (no backend), so it deploys to
**Cloudflare Pages** (not Workers) straight from the GitHub repo. Every push to
`main` becomes a production deploy; every other branch/PR gets a preview URL.

Everything below is done in the Cloudflare web dashboard — no CLI needed.

## Files in the repo that Pages uses

| File | Purpose |
|---|---|
| `public/_headers` | Security headers + long-lived cache for hashed `/assets/*`, `no-cache` for `index.html` |
| `public/_redirects` | SPA fallback (`/* → /index.html 200`) |
| `.nvmrc` | Pins Node 22 for the Pages build image |

Vite copies `public/` verbatim into `dist/`, so these end up at the root of the
deployed site.

## 1. Create the Pages project

1. Log in at <https://dash.cloudflare.com>.
2. Left sidebar → **Compute (Workers & Pages)** → **Create** → pick the **Pages** tab → **Connect to Git**.
3. Authorise Cloudflare's GitHub app if prompted, then select the
   `Churi-is/yaku-za-riichi-trainer` repository → **Begin setup**.
4. Fill in the build settings:

   | Setting | Value |
   |---|---|
   | Project name | `riichi-trainer` (anything — this only sets the `*.pages.dev` URL) |
   | Production branch | `main` |
   | Framework preset | **Vite** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | *(leave blank)* |

5. Expand **Environment variables (advanced)** and add:

   | Variable | Value |
   |---|---|
   | `NODE_VERSION` | `22` |

   (`.nvmrc` also pins this; setting the variable is belt-and-braces.)

6. Click **Save and Deploy**. The first build takes ~1–2 minutes. When it
   finishes you'll get a `https://riichi-trainer.pages.dev` URL — open it and
   confirm the game loads.

## 2. Attach the custom domain

Because `churi.net` is already on Cloudflare, this is fully automatic.

1. In the Pages project → **Custom domains** tab → **Set up a custom domain**.
2. Enter `riichi.churi.net` → **Continue**.
3. Cloudflare shows the DNS record it will create (a proxied `CNAME
   riichi → riichi-trainer.pages.dev`). Click **Activate domain**.
4. Wait for the status to change from *Initializing* to **Active** (usually
   under a minute; up to a few minutes for the TLS certificate).

> If `churi.net`'s DNS is **not** on Cloudflare, the same screen will instead
> tell you to add a `CNAME riichi → riichi-trainer.pages.dev` record at your
> DNS provider. Add it, then come back and click **Check DNS records**.

## 3. Verify

- <https://riichi.churi.net> loads the trainer over HTTPS (Pages issues and
  renews the certificate automatically).
- `https://riichi-trainer.pages.dev` still works as a fallback URL.
- In DevTools → Network, `/assets/*.js` responds with
  `cache-control: public, max-age=31536000, immutable` — confirms `_headers`
  is being applied.

## 4. Optional hardening (dashboard-only)

- **Build watch paths** (Pages project → Settings → Builds & deployments):
  add `docs/**` and `*.md` to *Exclude paths* so doc-only commits don't
  trigger a deploy.
- **Preview deployments**: same page, choose *All non-production branches*
  (default) to get a URL per PR, or *None* to only deploy `main`.
- **Access control for previews**: Settings → General → *Enable access
  policy* restricts `*.pages.dev` preview URLs to your Cloudflare Access users
  while leaving `riichi.churi.net` public.
- **Redirect `pages.dev` → custom domain**: not needed, but if you want a
  single canonical URL, add a Bulk Redirect in the zone dashboard
  (Rules → Redirect Rules).

## Day-to-day

- **Deploy**: merge/push to `main`. Nothing else to do.
- **Roll back**: Pages project → **Deployments** → `⋯` on an older production
  deploy → **Rollback to this deployment**.
- **Build logs**: click any deployment in the same list.
