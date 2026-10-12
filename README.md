# GreenStore

GreenStore is a frontend for an Azerbaijani classifieds marketplace for plants, trees, garden products and landscaping
services. Individuals and businesses publish ads, and buyers contact sellers directly. It works like Turbo.az: there is
no cart and no checkout.

It is built from the approved Figma design. [`FIGMA_AUDIT.md`](FIGMA_AUDIT.md) covers the screens, tokens, assets, data
and known gaps, and [`IMPLEMENTATION_REPORT.md`](IMPLEMENTATION_REPORT.md) covers what was built and how it was verified.

## Stack

* Vite 7, React 19, TypeScript 5.9 (strict)
* Tailwind CSS v4: the design tokens live in `src/styles/index.css` under `@theme`
* React Router 7
* `lucide-react` icons (every icon in the design is a Lucide glyph)
* Inter, self-hosted through `@fontsource/inter`
* Vitest and Testing Library

## Scripts

```bash
npm install
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

## Backend integration (ASP.NET Core Web API)

There is no backend yet. Everything runs on local mock data:

* **Data shape.** The types in `src/types` are shaped like camelCase JSON DTOs.
* **Reads.** The read functions in `src/services/marketplace.ts` mirror the planned query endpoints, for example
  `GET /api/listings?q=&categoryId=&cityIds=&minPrice=&maxPrice=&vip=&delivery=&sellerType=&sort=`. Swapping the mock
  for API calls means changing those functions and the `src/data/*` lookups to `fetch`, plus adding a data-fetching layer.
* **Local state.** Favourites, the session and the ads you post are kept in `localStorage` through `src/app/store.tsx`.
  Replace that with authenticated API calls (`/api/favorites`, `/api/auth`, `/api/listings`).
* **Images.** Image paths (`/images/...`) stand in for URLs that the API or a CDN would return.
