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

None are required for the demo (`DATA_SOURCE=mock`). Copy [`.env.example`](.env.example) to `.env.local` to
override them locally.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Vercel URL, else `http://localhost:3000` | Public origin for canonical URLs, Open Graph, the sitemap and robots.txt |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | "Demo versiya" banner |
| `SEO_INDEXABLE` | `false` | Indexing opt-in. It only takes effect together with `DATA_SOURCE` ≠ `mock` |
| `DATA_SOURCE` | `mock` | `mock`: Figma sample data. `api`: the GreenStore Web API (`backend/`, `src/services/apiRepository.ts`) |
| `API_BASE_URL` | – | `DATA_SOURCE=api` only, server-only: the API's origin, e.g. `http://localhost:5080` |
| `API_INTERNAL_KEY` | – | `DATA_SOURCE=api` only, server-only secret: sent as `X-Internal-Key`, equal to the API's `Internal__ApiKey`. Never commit a real value |
| `CLIENT_IP_HEADER` | – | `DATA_SOURCE=api` only: a header the hosting overwrites with the visitor's IP on every request (`x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip` from nginx). When set, only it is read. See [Visitor IP](#visitor-ip-behind-the-hostings-proxy) |
| `TRUSTED_PROXY_HOPS` | `1` | `DATA_SOURCE=api` only: how many proxies in front of Next.js append to `X-Forwarded-For`. The visitor's IP is that many entries from the right; `0` passes no IP |
| `API_PUBLIC_URL` | `API_BASE_URL` | `DATA_SOURCE=api` only: the API's address as browsers reach it. The posting's photos are uploaded there straight from the browser, so the CSP's `connect-src` names it. Set it when `API_BASE_URL` is a private address |
| `MEDIA_BASE_URL` | `<API_PUBLIC_URL>/media` | `DATA_SOURCE=api` only: where uploaded photos are served (the API's `Media__BaseUrl`, later the CDN): the CSP's `img-src` and `images.remotePatterns`. Read when the server starts, so set it for the build and the server alike |
| `REVALIDATE_SECRET` | – | `DATA_SOURCE=api` only, server-only secret: the API's change notices (`POST /api/revalidate`) carry it; equal to the API's `Revalidation__Secret` (dev: `dev-revalidate-secret`). Unset, every notice is refused and pages refresh within a minute on their own |

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

### Visitor IP behind the hosting's proxy

With `DATA_SOURCE=api` the Next.js server passes the visitor's IP to the API (`X-Client-IP`, believed only with
`API_INTERNAL_KEY`), and the API's per-IP limits count it: SMS codes (20 an hour, 100 a day per IP), wrong passwords
and anonymous writes. The IP must therefore come from the hosting, never from the browser. Next.js fills
`X-Forwarded-For` itself only when the request has none, so a visitor who reaches `next start` directly can send any
value and dodge those limits, for example to burn the site-wide daily SMS cap (`src/services/clientIp.ts`).

* **Never expose `next start` to the internet directly.** Put the hosting's proxy or a reverse proxy in front of it and
  let only that proxy reach the Next.js port.
* **Vercel:** nothing to set. Vercel overwrites `X-Forwarded-For` with the visitor's address, and the default
  `TRUSTED_PROXY_HOPS=1` reads it. `CLIENT_IP_HEADER=x-vercel-forwarded-for` is the explicit alternative.
* **nginx in front of `next start`:** either `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` (appends
  the address nginx saw; default `TRUSTED_PROXY_HOPS=1`), or `proxy_set_header X-Real-IP $remote_addr;` with
  `CLIENT_IP_HEADER=x-real-ip`.
* **Cloudflare in front:** `CLIENT_IP_HEADER=cf-connecting-ip`, and let only Cloudflare's addresses reach the origin.
  With Cloudflare and nginx both appending to `X-Forwarded-For`, `TRUSTED_PROXY_HOPS=2` works too.
* **Another platform:** find the header it overwrites (Fly.io: `fly-client-ip`) or count its proxies that append to
  `X-Forwarded-For`. If you cannot tell, set `TRUSTED_PROXY_HOPS=0`: no IP is passed, which is safe, but every visitor
  then shares the Next.js server's per-IP limits, so a busy site soon hits them.
* A proxy that passes the browser's `X-Forwarded-For` on untouched (nginx without either line above) is as unsafe as no
  proxy. A self-hosted production server that sets neither variable logs a reminder once
  (`CLIENT_IP_HEADER and TRUSTED_PROXY_HOPS are not set`).

## Backend integration (ASP.NET Core Web API)

The API lives in [`backend/`](backend/README.md) (ASP.NET Core 10, PostgreSQL). Its integration points are:

* **Reads (phase 1, done).** Server pages read data only through `MarketplaceRepository`
  (`src/services/repository.ts`). `DATA_SOURCE=api` selects `src/services/apiRepository.ts`: `fetch` to
  `API_BASE_URL/api/v1/...` with `Accept-Language: az` and `X-Internal-Key`, cached by Next for 60 seconds with tags
  (`next: { revalidate: 60, tags }`). Methods whose endpoints come in a later phase throw «not implemented yet
  (phase N)». Contract changes: [`docs/handoff/backend-contract.md`](docs/handoff/backend-contract.md).
* **Running the site on the API locally:**

  ```bash
  cd backend && dotnet run --project src/GreenStore.Api     # http://localhost:5080, migrates and seeds the dev DB
  # in another terminal, from the repo root:
  DATA_SOURCE=api API_BASE_URL=http://localhost:5080 API_INTERNAL_KEY=dev-internal-key npm run dev
  ```

  `next build` with `DATA_SOURCE=api` reads the API for the static pages (home), so start the API first. Listing and
  service pages are not prerendered with the API: each renders on its first visit and is then cached.
* **Phone numbers** are never part of a page (backend-contract.md 3.1): public reads carry only `phoneMasked`, and
  «Nömrəni göstər» asks a Server Action (`src/features/contact/actions.ts`) for the number (`POST
  /listings/{id}/phone-reveals`, `/sellers/{id}/phone-reveals` in API mode), which the owner's statistics count.
* **Accounts (phase 2, done).** With `DATA_SOURCE=mock` the demo session, favourites and saved searches stay in
  `localStorage` (`src/state/store.tsx`), exactly as before. With `DATA_SOURCE=api`:
  * the sign-ins and registration are Server Actions (`src/features/auth/actions.ts`); they keep the API's session
    token in the httpOnly cookie `gs_session` (Secure in production, SameSite=Lax, 30 days, `src/services/session.ts`)
    and write `gs_hint` next to it: «signed in» and the avatar's initials only, which the pre-hydration script reads for
    the first paint (`src/state/bootstrap.ts`). «Çıxış» ends the session on the API and removes both;
  * after the page loads the store asks the server who is signed in (`loadSession` in
    `src/features/account/actions.ts`: `GET /me`, `/me/seller`, `/me/favorites`) when the hint says someone is;
  * favourites and saved searches of a signed-in visitor are the API's; a guest's favourites stay in `localStorage` and
    join the account on sign-in;
  * `/kabinet/profil` saves to `PATCH /me` and, for a business, its «mağaza» (`PATCH /me/seller`), which its public
    page `/saticilar/<slug>` shows at once. A new phone number is confirmed with an SMS code first;
  The SMS code is shown on screen while the API runs with `Otp:ExposeDemoCode=true` (Development only). The private
  routes are isolated in their own route groups and are `noindex`.
* **Listing cycle (phase 3, done).** With `DATA_SOURCE=mock` posting, «Elanlarım» and the moderation page work in the
  browser as before (`localStorage`, `src/data/admin`). With `DATA_SOURCE=api`:
  * «Elan yerləşdir» keeps the draft and its photos in the browser (a guest can fill it all), and on «Elanı göndər»
    uploads each photo straight to the API (`startPhotoUpload` asks for a one-time address, the browser `PUT`s the
    file there: `src/features/posting/upload.ts`), then sends the listing with the draft's `Idempotency-Key`
    (`submitPosting`). The confirmation shows the API's listing number. A refusal names the field and links its step;
    an uploaded photo is not uploaded again on a retry;
  * «Elanlarım» lists `GET /me/listings` with each listing's 14-day statistics; «Yenilə», «Deaktiv et», «Aktiv et» and
    «Sil» go to the API (`src/features/cabinet/actions.ts`), and a rejection shows the reason's words for its code with
    the moderator's note. «Redaktə et» keeps the listing's photos on the API (`OwnListing.photoIds`) and sends the
    version it opened; the owner's preview (`/kabinet/elanlar/<slug>`) renders on the server;
  * the listing and service pages send one view per page view (`ViewBeacon`, a Server Action), which the API counts
    once a visitor a day and never for the owner;
  * `/idareetme/moderasiya` is the API's queue (`src/services/adminRepository.ts`) for a signed-in moderator or admin
    (anyone else is asked to sign in or told it is for staff), rendered on the server, with the filters in the address
    and the decision sent with the version the moderator saw;
  * a Server Action that changes what the site shows refreshes those pages at once (`updateTag` with the API's tags),
    and `POST /api/revalidate` takes the API's change notices for the rest (`REVALIDATE_SECRET`). The data cache is per
    server process: with several Next.js servers each needs the notice (or a shared cache handler).
* **Reports, support and the staff pages (phase 4, done).** With `DATA_SOURCE=mock` the forms answer from the demo
  and the admin pages read `src/data/admin`, as before. With `DATA_SOURCE=api`:
  * «Şikayət et» sends a reason code (`src/features/seller/complaintReasons.ts`, backend-contract.md 4.1); «Bizimlə
    əlaqə» returns the API's ticket. «Usta çağır» (service requests) was removed from the site and the API on
    24 Nov 2026 (docs/handoff/remove-usta-cagir.md);
  * `/idareetme` shows every section's numbers above the moderation queue, `/idareetme/sikayetler` handles reports
    (status, resolution, note, history; admins also block the account behind the target and verify sellers) and
    `/idareetme/kateqoriyalar` (admins only) edits categories in three languages. All are rendered on the server and
    refused to anyone without the role.
* **Images.** Demo image paths (`/images/...`) are the site's own; uploaded photos come from the API's media address
  (`MEDIA_BASE_URL`), which the CSP and `images.remotePatterns` allow.
