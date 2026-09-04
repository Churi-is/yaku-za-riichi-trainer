# Deploying to Cloudflare Workers — `riichi.churi.net`

This app is a static Vite Single Page Application (SPA) deployed on **Cloudflare Workers** using **Workers Static Assets**. Every push to `main` deploys to production and serves at <https://riichi.churi.net>.

## Configuration Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Defines the worker name, static assets directory (`./dist`), SPA not-found handling (`single-page-application`), and custom domain route (`riichi.churi.net`) |
| `public/_headers` | Security headers + long-lived cache for hashed `/assets/*`, `no-cache` for `index.html` |
| `public/_redirects` | SPA fallback (`/* → /index.html 200`) |
| `.nvmrc` | Pins Node 22 for build environments |

Vite copies `public/` verbatim into `dist/`, so `_headers` and `_redirects` are included in the assets bundle uploaded by Wrangler.

## Setup & Deployment

### 1. Cloudflare Dashboard / Git Integration

When connecting your repository in the Cloudflare Dashboard under **Workers & Pages**:

1. Go to **Compute (Workers & Pages)** → **Create** → **Workers** (or connect existing).
2. Build settings:
   - **Framework preset**: `None` or `Vite` (with `wrangler.jsonc` present, Wrangler handles asset deployment automatically)
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
   - **Output directory**: `dist` (or defined in `wrangler.jsonc`)
3. Environment variables:
   - `NODE_VERSION`: `22`

### 2. Custom Domain (`riichi.churi.net`)

`wrangler.jsonc` contains:
```jsonc
{
  "routes": [
    {
      "pattern": "riichi.churi.net",
      "custom_domain": true
    }
  ]
}
```

- When deployed, Cloudflare will automatically bind the Worker to the custom domain `riichi.churi.net` in your Cloudflare zone `churi.net`.
- **Note if migrating from Cloudflare Pages**: If `riichi.churi.net` was previously assigned to a Pages project or has an existing conflicting CNAME record in your Cloudflare DNS settings, remove the old Pages custom domain or conflicting DNS record in Cloudflare Dashboard so Wrangler can manage the custom domain.

### 3. Local Deployment via CLI

You can also deploy manually via CLI:
```bash
npm run build
npm run deploy
```
