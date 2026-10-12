# GreenStore

GreenStore is a frontend for an Azerbaijani classifieds marketplace for plants, trees, garden products and landscaping
services. Individuals and businesses publish ads, and buyers contact sellers directly. It works like Turbo.az: there is
no cart and no checkout.

It is built from the approved Figma design. [`FIGMA_AUDIT.md`](FIGMA_AUDIT.md) covers the screens, tokens, assets, data
and known gaps, and [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md) covers what was built and how it was verified.

> **Demo build.** There is no backend yet. All listings, sellers, services, people, phone numbers and statistics are
> sample data copied from the Figma design (`src/data/`). Login and registration are simulated in the browser: any
> well-formed input signs in to the demo seller account, nothing is sent to a server, and everything a visitor changes
> is kept only in that browser's `localStorage`. A "Demo versiya" banner says so on every page (see
> [`src/config/demo.ts`](src/config/demo.ts)).

## Stack

* Vite 7, React 19, TypeScript 5.9 (strict)
* Tailwind CSS v4: the design tokens live in `src/styles/index.css` under `@theme`
* React Router 7
* `lucide-react` icons (every icon in the design is a Lucide glyph)
* Inter, self-hosted through `@fontsource/inter`
* Vitest and Testing Library

## Scripts

```bash
npm ci             # Node 22 (see .nvmrc)
npm run dev        # http://localhost:5173
npm run build      # type-check (tsc -b) + production build into dist/
npm run typecheck
npm run lint
npm test           # vitest run
npm run preview    # serve dist/
```

## Project structure

```
src/
  app/          router (routes.tsx) and app state (favourites, mock session, ads you post)
  layouts/      Home / Main / Auth / Workflow / Admin layouts (the four header and footer variants in Figma)
  components/   ui/ (Button, Badge, Field, Panel, Notice, Dialog, EmptyState…), cards/, layout/
  features/     page-specific components, grouped by area (search, listing, seller, services, account, post-ad, admin)
  pages/        one component per route
  data/         typed mock data copied from the Figma file
  services/     query layer (shaped like the future Web API)
  lib/          formatting helpers (₼ prices, Azerbaijani dates, search normalisation)
  types/        domain types (Listing, Seller, Service, Category…)
  styles/       Tailwind entry + design tokens
public/images/  product, service and seller photos exported from Figma (WebP)
docs/figma/     Figma reference renders + image manifest (Figma node → file)
```

## Routes

| Path | Screen |
| --- | --- |
| `/` | Home page (Ana səhifə) |
| `/elanlar` | Product search and catalogue. Filters are stored in the query string: `q`, `kateqoriya`, `seher`, `min`, `max`, `vip`, `catdirilma`, `saticiNovu`, `siralama`, `gorunus` |
| `/elanlar/:slug` | Listing detail |
| `/saticilar/:slug` | Seller profile |
| `/xidmetler`, `/xidmetler/:slug` | Services catalogue and service detail |
| `/daxil-ol`, `/qeydiyyat` | Login and registration. These use a mock session: any valid input signs in as the demo seller |
| `/kabinet`, `/kabinet/profil`, `/secilmisler` | Cabinet, profile and favourites |
| `/elan-yerlesdir/:step`, `/elan-yerlesdir/gonderildi` | 6-step ad posting wizard and its confirmation |
| `/idareetme/moderasiya`, `/idareetme/kateqoriyalar`, `/idareetme/sikayetler` | Moderation tools |

## Deploying to Vercel (staging)

The repository is ready for Vercel. [`vercel.json`](vercel.json) holds the whole configuration, so the project needs no
manual build settings and **no environment variables or secrets**.

| Setting | Value (from `vercel.json` / `package.json`) |
| --- | --- |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` (type-check + `vite build`) |
| Output directory | `dist` |
| Node.js | 22.x (`engines` in `package.json`, `.nvmrc`) |
| SPA routing | Every path that is not a real file is rewritten to `/index.html`, so deep links such as `/elanlar/zeytun-agaci-olea-europaea` and page refreshes work. Missing files under `/assets/` and `/images/` still return a real 404 |
| Headers | `X-Robots-Tag: noindex, nofollow` (keeps the demo out of search engines), CSP and basic security headers, long-term caching for hashed `/assets/*`, 1-hour caching for `/images/*` |

### Option A — Vercel dashboard (recommended)

1. Merge the pull request into `main` (Vercel deploys `main` as Production). To try it before merging, use the preview
   in step 7.
2. Sign in at <https://vercel.com> with GitHub.
3. Click **Add New… → Project**.
4. Under **Import Git Repository**, choose `HuseynovRuslan/greenstore-marketplace` and click **Import**. If the repository
   is not listed, click **Adjust GitHub App Permissions** and give Vercel access to it.
5. On **Configure Project**:
   * **Framework Preset:** `Vite`, detected automatically.
   * **Root Directory:** `./`.
   * **Build and Output Settings:** leave as they are; `vercel.json` overrides them.
   * **Environment Variables:** leave empty. `VITE_DEMO_MODE` is optional and defaults to showing the demo banner.
6. Click **Deploy**. When the build finishes, Vercel shows the Production URL, for example
   `https://greenstore-marketplace.vercel.app`.
7. **Preview deployments.** With the Git integration connected, every push to another branch or pull request gets its
   own Preview URL, and the Vercel bot comments it on the PR. Preview URLs are protected by **Vercel Authentication** by
   default, so only members of your Vercel team can open them. To share a preview publicly, disable it under
   **Project → Settings → Deployment Protection**.
8. **Custom domain (optional).** Go to **Project → Settings → Domains**, add for example `staging.greenstore.az`, and
   create the DNS record that Vercel shows (usually a `CNAME` to `cname.vercel-dns.com`).

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
git clone https://github.com/HuseynovRuslan/greenstore-marketplace.git
cd greenstore-marketplace          # check out main, or the PR branch to stage it before merging
vercel                             # first run: link/create the project; accept the detected settings → Preview URL
vercel --prod                      # promote to the Production URL
```

### After deploying, check

* Open a deep link directly and refresh it, for example `/elanlar/zeytun-agaci-olea-europaea` and
  `/idareetme/sikayetler`. The page must load, not show a Vercel 404.
* Product photos load, and the "Demo versiya" banner is visible.
* `curl -sI https://<your-url>/kabinet` shows `x-robots-tag: noindex, nofollow`.

### Before a real (public, indexed) launch

* Connect the real API first. Then set `VITE_DEMO_MODE=false` in **Settings → Environment Variables** and redeploy to
  hide the demo banner.
* Remove the `X-Robots-Tag` header from `vercel.json` so search engines can index the site.
* If the API runs on another origin, add it to `connect-src` in the `Content-Security-Policy` header.

## Backend integration (ASP.NET Core Web API)

There is no backend yet. Everything runs on local mock data:

* **Data shape.** The types in `src/types` are shaped like camelCase JSON DTOs.
* **Reads.** The read functions in `src/services/marketplace.ts` mirror the planned query endpoints, for example
  `GET /api/listings?q=&categoryId=&cityIds=&minPrice=&maxPrice=&vip=&delivery=&sellerType=&sort=`. Swapping the mock
  for API calls means changing those functions and the `src/data/*` lookups to `fetch`, plus adding a data-fetching layer.
* **Local state.** Favourites, the session and the ads you post are kept in `localStorage` through `src/app/store.tsx`.
  Replace that with authenticated API calls (`/api/favorites`, `/api/auth`, `/api/listings`).
* **Images.** Image paths (`/images/...`) stand in for URLs that the API or a CDN would return.
