# GreenStore

GreenStore is the frontend of an Azerbaijani classifieds marketplace for plants, trees, garden products and
landscaping services. Individuals and businesses publish ads, and buyers contact sellers directly. It works like
Turbo.az: there is no cart and no checkout.

It is built from the approved Figma design:

* [`FIGMA_AUDIT.md`](FIGMA_AUDIT.md) covers the screens, tokens, assets, data and known gaps.
* [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md) covers the original React + Vite build and how it was verified.
* [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) and [`MIGRATION_REPORT.md`](MIGRATION_REPORT.md) cover the move to the
  Next.js App Router.
* [`SEO_ARCHITECTURE.md`](SEO_ARCHITECTURE.md) covers rendering, canonical and indexing rules, structured data, the
  sitemap and robots.txt.

> **Demo build — not indexable.** There is no backend yet. All listings, sellers, services, people, phone numbers and
> statistics are sample data copied from the Figma design (`src/data/`). Login and registration are simulated in the
> browser: any well-formed input signs in to the demo seller account, nothing is sent to a server, and everything a
> visitor changes is kept only in that browser's `localStorage`. A "Demo versiya" banner says so on every page. While
> the data is sample data, every page is `noindex`, robots.txt disallows crawling, and the sitemap is empty (see
> [`src/seo/env.ts`](src/seo/env.ts)).

## Stack

* Next.js 16 (App Router), React 19 and TypeScript 5.9 (strict).
* Tailwind CSS v4, through `@tailwindcss/postcss`. The design tokens live in `src/styles/index.css` under `@theme`.
* `lucide-react` icons. Every icon in the design is a Lucide glyph.
* Inter, self-hosted through `@fontsource/inter`.
* Vitest and Testing Library for unit and component tests. Vitest runs on Vite, which is a dev dependency only.

## Scripts

```bash
npm ci             # Node 22 (see .nvmrc / "engines")
npm run dev        # http://localhost:3000
npm run build      # production build (includes the TypeScript check)
npm start          # serve the production build on :3000
npm run typecheck
npm run lint       # ESLint (eslint-config-next: core-web-vitals + typescript)
npm test           # vitest run
```

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck, the unit tests and the production build on every pull
request and on pushes to `main`.

## Environment variables

None are required. Copy [`.env.example`](.env.example) to `.env.local` to override them locally.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Vercel URL, else `http://localhost:3000` | Public origin for canonical URLs, Open Graph, the sitemap and robots.txt |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | "Demo versiya" banner |
| `SEO_INDEXABLE` | `false` | Indexing opt-in. It only takes effect together with `DATA_SOURCE` ≠ `mock` |
| `DATA_SOURCE` | `mock` | `mock`: Figma sample data. `api`: the future Web API repository, not implemented yet |

## Project structure

```
src/
  app/          Next.js routes: route groups (home)/(main)/(auth)/(workflow)/(admin), layouts, metadata,
                robots.ts, sitemap.ts, not-found pages
  views/        page bodies rendered by the routes (server components, plus client pages for private areas)
  components/   ui/ (Button, Badge, Field, Panel, Notice, Dialog, Pagination…), cards/,
                layout/ (header, footer, frames, ClientGate + loading frames)
  features/     page-specific components and client islands, grouped by area
                (home, search, listing, seller, services, account, post-ad, admin, contact)
  services/     data-access boundary: MarketplaceRepository interface + mock implementation, query helpers
  state/        client state: favourites, demo session and submitted ads (localStorage, hydration-safe)
  seo/          switches (env.ts), metadata, catalogue indexing rules, JSON-LD, sitemap/robots builders
  data/         typed sample data copied from the Figma file
  lib/          formatting (₼ prices, Azerbaijani dates, collation), pagination and search-param helpers
  types/        domain types (Listing, Seller, Service, Category…)
  styles/       Tailwind entry + design tokens
public/images/  product, service and seller photos exported from Figma (WebP)
docs/figma/     Figma reference renders + image manifest (Figma node → file)
```

## Routes

| Path | Screen | Rendering |
| --- | --- | --- |
| `/` | Home page (Ana səhifə) | static |
| `/elanlar` | Product catalogue. Filters live in the query string: `q`, `kateqoriya`, `alt`, `seher`, `min`, `max`, `nov`, `hundurluk`, `yas`, `vip`, `catdirilma`, `saticiNovu`, `siralama`, `gorunus`, `sehife` | server, per request |
| `/kateqoriyalar/:kateqoriya`, `/kateqoriyalar/:kateqoriya/:seher` | Category page and category × city page (same catalogue UI) | server, per request |
| `/elanlar/:slug` | Listing detail | prerendered for every active listing |
| `/saticilar/:slug` | Seller profile | server, per request |
| `/xidmetler`, `/xidmetler/:slug` | Services catalogue and service detail | per request / prerendered |
| `/daxil-ol`, `/qeydiyyat` | Login and registration (mock session) | private, noindex |
| `/kabinet`, `/kabinet/profil`, `/secilmisler` | Cabinet, profile and favourites | private, rendered in the browser |
| `/kabinet/elanlar/:slug` | Owner preview of the seller's own unpublished listings (pending, expired, or posted in this browser) | private, noindex, rendered in the browser |
| `/elan-yerlesdir[/:step]`, `/elan-yerlesdir/gonderildi` | 6-step ad posting wizard and its confirmation | private, rendered in the browser |
| `/idareetme`, `/idareetme/moderasiya`, `/idareetme/kateqoriyalar`, `/idareetme/sikayetler` | Moderation tools (demo) | private, noindex |

Unknown URLs, unpublished listings (also for their owner, who uses the preview above), and unknown sellers, services
or categories return a real HTTP 404. Private pages show a loading skeleton of the page until the browser has read the
demo session and local data. A small inline script in `<head>` (`src/state/bootstrap.ts`) makes the header show the
right signed-in or guest state from the first paint.

## Deploying to Vercel (staging)

Next.js needs no `vercel.json`. Security and `noindex` headers come from [`next.config.ts`](next.config.ts).
**No environment variables or secrets are required.** The defaults keep the deployment non-indexable.

1. Sign in at <https://vercel.com> with GitHub, then click **Add New… → Project**.
2. Import `HuseynovRuslan/greenstore-marketplace`. If the repository is not listed, click **Adjust GitHub App
   Permissions** and give Vercel access to it.
3. On **Configure Project**:
   * **Framework Preset:** `Next.js`. It is detected automatically.
   * **Root Directory:** `./`.
   * **Build and Output Settings:** leave the defaults (`npm run build`, output `.next`). Node.js 22.x comes from
     `engines`.
   * **Environment Variables:** none are needed. You can set `SEO_INDEXABLE=false` and `DATA_SOURCE=mock` explicitly
     to document the intent; those are the defaults. `NEXT_PUBLIC_SITE_URL` is optional; without it, the Vercel URL
     is used for canonical and Open Graph URLs.
4. Click **Deploy**. Vercel builds the production branch, `main` by default. Every other branch and pull request
   gets its own Preview URL. To stage this work before it is merged, open the pull request's Preview URL, or change
   **Project → Settings → Git → Production Branch**. Preview URLs are protected by Vercel Authentication by default;
   change this under **Project → Settings → Deployment Protection**.
5. Optional: add a staging domain under **Project → Settings → Domains**, for example `staging.greenstore.az`, and
   set `NEXT_PUBLIC_SITE_URL` to it.

Vercel CLI alternative: `npm i -g vercel && vercel login && vercel` (Preview), then `vercel --prod`.

### After deploying, check

* Deep links load directly and after a refresh, for example `/elanlar/zeytun-agaci-olea-europaea` and
  `/kateqoriyalar/agaclar`.
* `/elanlar/yoxdur` returns 404.
* Product photos load, and the "Demo versiya" banner is visible.
* `curl -sI https://<your-url>/ | grep -i x-robots-tag` shows `noindex, nofollow`.
* `/robots.txt` disallows `/`, and `/sitemap.xml` is empty.

### Before a real (public, indexed) launch

Follow the launch checklist in [`SEO_ARCHITECTURE.md`](SEO_ARCHITECTURE.md#9-launch-checklist-when-real-data-exists):

* connect the API (`DATA_SOURCE=api`);
* set the production `NEXT_PUBLIC_SITE_URL`;
* set `NEXT_PUBLIC_DEMO_MODE=false`;
* set `SEO_INDEXABLE=true` in the production environment only.

If the API runs on another origin, add it to `connect-src` in the CSP (`next.config.ts`).

## Backend integration (ASP.NET Core Web API)

There is no backend yet. Its integration points are:

* **Reads.** Server pages read data only through `MarketplaceRepository` (`src/services/repository.ts`): listings
  search and paging, listing, seller and service detail, taxonomy, and home content. Implement it with `fetch` calls
  to the Web API. The planned query shape is
  `GET /api/listings?q=&categoryId=&cityIds=&minPrice=&maxPrice=&vip=&delivery=&sellerType=&sort=&page=`.
  Then switch `getRepository()` with `DATA_SOURCE=api`. The types in `src/types` are shaped like camelCase JSON DTOs.
* **Auth and per-user state.** The demo session, favourites and submitted ads live in `src/state/store.tsx`
  (`localStorage`). Replace them with authenticated API calls (`/api/auth`, `/api/favorites`, `/api/me/listings`).
  The private routes are already isolated in their own route groups and are `noindex`.
* **Images.** Image paths (`/images/...`) stand in for object-storage URLs. Switch to `next/image` with a loader once
  uploads exist.
