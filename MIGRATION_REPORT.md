# GreenStore — Next.js migration report

**Branches and PRs**
* Source: the accepted React + Vite frontend, branch `claude/upbeat-albattani-0klb4f`, commit `a1fbc77`, PR #1.
* Target: branch `claude/nextjs-migration`, created from `a1fbc77`, with a new pull request into `main`.
* PR #1 and its branch were not changed, merged or closed. Nothing was deployed.

**Related documents**
* Plan: [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md).
* SEO design: [`SEO_ARCHITECTURE.md`](SEO_ARCHITECTURE.md).

## 1. Outcome

* **Framework.** The whole frontend runs on Next.js 16.3 (App Router), React 19 and Tailwind CSS 4. React Router and
  the Vite build are gone; Vite remains only as Vitest's runner.
* **Design.** Every Figma layout, component, image and text is unchanged. **All 60 reference screenshots (20 screens
  × 1440 / 768 / 390, guest and signed in) are pixel-identical to the accepted Vite build** (§5.2).
* **Content.** Public content is server-rendered: home, catalogue, category pages, listing, seller, services and
  service detail. Listing cards, prices, headings, breadcrumbs, metadata and JSON-LD are in the initial HTML.
* **Indexing.** The SEO foundation is in place (canonical and indexing rules, Open Graph, JSON-LD, sitemap,
  robots.txt, real 404s, crawlable pagination). It is **switched off**: while the data is the Figma sample data, the
  site is `noindex` everywhere.
* **Backend readiness.** There are data-access, client-state and private-route boundaries for the ASP.NET Core API.
  No backend was built.

## 2. Architecture

```
src/app/                         routes only (thin): params → repository → view, plus metadata and JSON-LD
  layout.tsx                     <html lang="az">, fonts, global CSS, AppStoreProvider, default metadata
  not-found.tsx                  global 404 (main header + compact footer)
  robots.ts, sitemap.ts
  (home)/                        "/"                                     HomeFrame
  (main)/                        catalogue, categories, listing, seller,  MainFrame
                                 services, cabinet, favourites
  (auth)/                        /daxil-ol, /qeydiyyat                   AuthFrame
  (workflow)/                    /elan-yerlesdir/*                       WorkflowFrame
  (admin)/                       /idareetme/*                            AdminFrame
src/views/                       page bodies (former src/pages)
src/services/repository.ts       MarketplaceRepository interface + getRepository()
src/services/mockRepository.ts   implementation over src/data (DATA_SOURCE=mock)
src/state/store.tsx              favourites, demo session, submitted ads (client, hydration-safe)
src/seo/                         env switches, metadata, catalogue rules, JSON-LD, sitemap/robots builders
```

### Server and client split

| Route | Server Component (in the HTML) | Client islands |
| --- | --- | --- |
| `/` | hero copy, category grid, VIP/latest listings, services, sellers, trust band | hero search form, favourite buttons, header, mobile nav |
| `/elanlar`, `/kateqoriyalar/…` | breadcrumb, heading, result cards (grid or list), pagination links | `SearchShell` (query field, filter sidebar/sheet, chips, sort, view toggle) |
| `/elanlar/[slug]` | breadcrumb, badges, title, specs, description, notices, related listings | gallery, favourite/share, phone reveal (panel + mobile bar share state through `RevealProvider`), complaint dialog |
| `/saticilar/[slug]` | cover, profile, contact panel, verified notice | phone reveal, complaint dialog, `SellerListings` (tabs/search/sort/pages, server-rendered first) |
| `/xidmetler` | breadcrumb, heading, service cards, pagination links | search form, category toggles, provider tabs + sort |
| `/xidmetler/[slug]` | all text sections, areas | gallery, favourite/share, phone reveal, portfolio viewer, complaint |
| `/kabinet/elanlar/[slug]` (owner preview) | frame + loading skeleton | the listing view, for the signed-in owner only |
| private pages | frame + loading skeleton | the page itself (local state) |

* 53 modules are `'use client'`. Cards, badges, buttons, panels, notices, section headers, the footer and all public
  page views are shared or server components.
* Shared components with no hooks carry no directive, so they render on the server and can also be used inside
  client trees.

### Routing changes

* `Link to=` became `next/link` `href=` in 42 files.
* `NavLink` became `Link` plus an active state from `usePathname()`. It keeps `aria-current="page"` and the same
  prefix matching; the mobile "Axtarış" tab is also active on `/kateqoriyalar/…`.
* `useNavigate`, `useLocation` and `useParams`:
  * now `useRouter` and `usePathname`;
  * route params come from the server `page.tsx` as props.
* Query-string state now follows a different flow:
  * the server page parses `searchParams` and renders the results;
  * client controls `router.push()` a new URL with `scroll: false`.
  * The header search reads `?q=` behind a Suspense boundary, so static pages keep their server HTML.
  * The header search also works without JavaScript: the form is a plain GET to `/elanlar` (or `/xidmetler` on the
    services pages), and the results are rendered on the server.
  * The seller page's in-place filters update the address bar with `history.replaceState`, which the App Router
    keeps in sync, so there is no server round trip per keystroke.
* The wizard's `location.state`:
  * The "show errors on the step you were sent back to" flag is now a small in-memory flash value.
  * The confirmation page reads the id of the last submitted ad from `localStorage`, as it already did after a
    refresh.
* Redirects:
  * Invalid wizard steps redirect on the server with a 307 to `/elan-yerlesdir/1`.
  * Deep links past the furthest step reached use `router.replace`.
* Removed: the scroll manager. Next.js scrolls to the top on navigation and follows `/#hash` links.
* `document.title` effects became `generateMetadata`.

### State and hydration

* **Storage hook.** `useLocalStorage` / `useStoredState` are built on `useSyncExternalStore`. The server snapshot is
  the default value and the browser value applies right after hydration, so markup always matches. The demo banner,
  favourites, session and submitted ads use it.
* **Browser-only pages.** Pages whose whole content comes from browser storage (cabinet, profile, favourites, wizard,
  owner preview, confirmation, moderation queue) render inside `ClientGate`. Until the browser has read that storage,
  the server HTML shows a **loading skeleton shaped like the page**: the real frame, headings, tabs and static panels,
  with placeholders (design colour `#e8ebe5`) only where per-visitor values go. The placeholders are sized like the
  default demo state, so the content replaces them without moving the page (§5.5). These pages are `noindex`.
* **Pre-paint session state.** An inline script in `<head>` (`src/state/bootstrap.ts`, the pattern from Next.js's
  "Preventing flash before hydration" guide) reads browser storage before the first paint and marks `<html>`:
  * `data-auth="user"`, with the display name in `--gs-user-name`;
  * `data-favorites="some|none"`;
  * `data-banner="dismissed"`.

  Until hydration, the header, the workflow header, the mobile nav's "Profil" link and the guest/user loading frames
  render both variants, and CSS shows the right one (`src/styles/index.css`). `<html>` carries
  `suppressHydrationWarning` because the script sets its attributes. On client-side navigations React renders the
  real state directly.
* **Deterministic formatting.** Azerbaijani alphabetical order and case mapping are implemented in `src/lib/format.ts`
  (`compareAz`, `lowerAz`, `upperAz`) instead of `localeCompare(…, 'az')` and `toLocaleLowerCase('az')`. Node and
  Chromium ship different ICU data: Chromium ordered "Qaraçöhrə" after "Leyland sərvi", which caused the only
  hydration mismatch found (species filter options).

### Backend readiness

* **Data access.** Route files call `getRepository()` only. `MarketplaceRepository` is async and API-shaped:
  * search with paging;
  * listing, seller and service by slug;
  * related listings;
  * taxonomy;
  * home content.

  The mock implementation wraps the existing query helpers. Selecting `DATA_SOURCE=api` without an implementation
  fails loudly instead of silently serving sample data.
* **Auth and per-user state.** These live only in `src/state/store.tsx` and the private route groups. Swapping in the
  real session (cookies or tokens from ASP.NET Core) touches those files.
* **Types.** `src/types` stays shaped like camelCase JSON DTOs.

### Dependencies

| Change | Packages |
| --- | --- |
| Added | `next@16.3.8`, `eslint-config-next@16.3.8`, `@tailwindcss/postcss` |
| Removed | `react-router`, `@tailwindcss/vite`, `eslint-plugin-react-refresh`, `eslint-plugin-react-hooks` (now via eslint-config-next), `typescript-eslint`, `@eslint/js`, `globals` |
| Kept | `vite` and `@vitejs/plugin-react`, for Vitest only |

* `npm audit --omit=dev`: **0 vulnerabilities**.
* `npm audit`: one high advisory, `braces` (GHSA-vfj7-8cjw-p6xm, ≤ 3.0.3). No patched version exists. It is only
  reachable through the dev tooling chain `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` →
  `micromatch`, and is not part of the build output or the runtime.
* Fresh installs without a lockfile hit an npm 10.9 resolver bug (`Cannot read properties of null (reading
  'edgesOut')`). `npm ci` with the committed lockfile works; regenerating the lockfile needs npm 11 (`npx npm@11
  install`).

### File map

| Vite build | Next.js build |
| --- | --- |
| `index.html`, `src/main.tsx`, `src/app/routes.tsx` | `src/app/**` (layout, route groups, pages) |
| `src/layouts/Layouts.tsx`, `ScrollManager.tsx` | `src/components/layout/Frames.tsx` + group `layout.tsx` files |
| `src/pages/**` | `src/views/**` (public views are server components) |
| `src/app/store.tsx` | `src/state/store.tsx` |
| `vite.config.ts` | `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts` |
| `vercel.json` (SPA rewrite + headers) | `next.config.ts` `headers()`; no rewrites needed |
| `eslint.config.js`, `tsconfig.app.json`, `tsconfig.node.json` | `eslint.config.mjs`, a single `tsconfig.json` |
| `src/env.d.ts` (`import.meta.env.VITE_DEMO_MODE`) | `process.env.NEXT_PUBLIC_DEMO_MODE` |
| `src/features/services/Pagination.tsx` (buttons) | `src/components/ui/PaginationLinks.tsx` (links) |

New:
* `src/services/repository.ts` and `mockRepository.ts`;
* `src/seo/*`;
* `src/features/search/SearchShell.tsx`;
* the client islands:
  * `features/home/HeroSearchForm.tsx`;
  * `features/contact/RevealContext.tsx`;
  * `features/seller/ComplaintButton.tsx`;
  * `features/services/{ServicesControls,ServiceComplaint,Portfolio}.tsx`;
  * `features/listing/OwnerListingPreview.tsx` (owner preview, `/kabinet/elanlar/[slug]`);
* loading frames:
  * `components/ui/Skeleton.tsx`;
  * `features/account/AccountSkeletons.tsx`;
  * `features/post-ad/WizardSkeleton.tsx`;
  * `views/ListingSkeleton.tsx`;
  * `components/layout/SessionFallback.tsx`;
* pre-paint state: `state/bootstrap.ts`, `components/layout/InlineScript.tsx`;
* `components/layout/ClientGate.tsx`, `components/ui/NavButton.tsx`, `lib/pagination.ts`, `lib/searchParams.ts`;
* `.github/workflows/ci.yml`.

## 3. Differences from the approved build

Visually nothing changed (§5.2). Behaviour and URL differences are listed here so they can be reviewed.

| # | Difference | Reason |
| --- | --- | --- |
| 1 | Category cards on the home page open `/kateqoriyalar/<kateqoriya>` instead of `/elanlar?kateqoriya=<kateqoriya>`. The page is the same catalogue UI with the same heading and results. The services card ("Landşaft və bağçılıq xidmətləri") opens `/xidmetler`; before, it opened `/xidmetler?kateqoriya=landsaft-xidmetleri`, which showed the same unfiltered catalogue. | Clean, indexable category URLs |
| 2 | The category crumb in listing breadcrumbs links to the category page. | Same |
| 3 | New routes: `/kateqoriyalar/[kateqoriya]` and `/kateqoriyalar/[kateqoriya]/[seher]`. The category × city page keeps the design's heading ("Bağınız üçün ağaclar") and adds the city as the last breadcrumb item and to the `<title>`. | SEO landing pages |
| 4 | Pagination numbers (catalogue, services, seller page) are `<a href="?sehife=N">` links instead of buttons. They look the same; "Növbəti" on the last page is still a disabled button. The catalogue (`/elanlar`) shows pagination only when there is more than one page of 24, so with the 16 sample listings nothing new appears. | Crawlable pagination |
| 5 | Unknown, pending, expired and rejected listings, unknown sellers, services and categories, and out-of-range pages return **HTTP 404**, for everyone, including the listing's owner. The SPA always answered 200. Owners open their unpublished listings, and ads posted in this browser, at the **private owner preview** `/kabinet/elanlar/[slug]`. It uses the same listing layout and status notice, is `noindex`, and is disallowed in robots.txt. The cabinet's "Elanlarım" rows link there for every listing that is not publicly published; published listings still link to their public page. | Real 404s, no soft 404s; private preview kept off public URLs |
| 6 | Cabinet, profile, favourites, the wizard, the owner preview, the confirmation page and the moderation queue render after hydration. Until then the server HTML shows a loading skeleton of the page; guests see the real sign-in prompt immediately. | No hydration mismatch and no signed-out flash |
| 7 | Before hydration, the header shows the session state the browser has, through the pre-paint script and CSS. The server HTML alone (no JavaScript at all) still shows the guest state. | Session lives in `localStorage` |
| 8 | Species filter options are in Azerbaijani alphabetical order (… K, Q, L …) on every browser. Before, the order depended on the browser's ICU data. | Same output on server and client |
| 9 | `/elan-yerlesdir/<invalid>` redirects on the server (307) rather than in the browser. | Same result, earlier |
| 10 | The home "Populyar: Zeytun ağacı" link is not prefetched. Next.js 16.3 leaves the prefetch of a non-ASCII query string unread (an open request, harmless for users, but it blocks "network idle" in tests). | Workaround |
| 11 | `safeNext()` (the login/registration `next` parameter) also rejects `/\…` paths. | Open-redirect hardening |
| 12 | Footer support items ("Tez-tez verilən suallar"…) are plain text rather than `href="#"` links. There are no pages for them in the design. Pixel-identical. | Kept the footer a server component, with no dead links |

## 4. Tests

| Suite | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint` (eslint-config-next core-web-vitals + typescript) | clean, 0 warnings |
| `npm test` (Vitest) | **55 tests in 10 files, all passing** |
| `npm run build` | passes. 40 pages generated: static pages, 16 prerendered listings and 6 services; the rest dynamic |

Vitest changes:

* `home.test.tsx` renders the server home view with repository data and mocks `next/navigation`. It adds a test
  that category cards link to category pages.
* `deploy-config.test.ts` (Vite `vercel.json`) was replaced by `next-config.test.ts`. That test checks:
  * site-wide `noindex` while the data is mock data;
  * private paths are `noindex` even when indexable;
  * the CSP is sent in production and not in dev.
* New `src/seo/seo.test.ts`, covering:
  * the indexing switch and site URL resolution;
  * forced robots metadata;
  * canonical, Open Graph and Twitter output;
  * description trimming;
  * the catalogue canonical and indexing rules (plain, paged, sort and view ignored, category and city
    canonicals, thin pages, search and filter combinations, invalid page numbers);
  * robots.txt in both states;
  * sitemap contents (only active listings; no private, filtered or duplicate URLs; thresholds);
  * JSON-LD (breadcrumbs, Product/Offer without invented properties, private sellers excluded, services without
    offers).
* New `StructuredData.test.tsx`: JSON-LD escaping.
* `format.test.ts`: Azerbaijani collation and case mapping.
* New `features/listing/ownerPreview.test.ts`, covering:
  * owner preview access (guest, owner, browser-only ads, other sellers, unknown slugs);
  * the cabinet link rule (public page only for published listings).
* New `state/bootstrap.test.ts`, covering the pre-paint script:
  * session, name and favourites markers;
  * banner dismissal;
  * corrupt storage.
* `assets.test.ts`, `marketplace.test.ts` and `query.test.ts` are unchanged and pass.
* CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck, unit tests and the production build on every pull
  request and on pushes to `main`.

## 5. Verification against the production build (`next build && next start`)

### 5.1 HTTP and HTML

* **Status codes** (curl):
  * 200 for every route, sample listing, seller and service, and both category page types;
  * 404 for an unknown listing, a pending or expired listing (also for its owner), unknown sellers, services,
    categories and cities, an unknown URL, an out-of-range `?sehife` and a missing image;
  * 200 + `X-Robots-Tag: noindex` + robots meta `noindex, nofollow` for the owner preview
    `/kabinet/elanlar/[slug]`;
  * 307 for an invalid wizard step.
* **Initial HTML** (curl, no JavaScript):
  * `/elanlar` contains its 16 listing cards and "Seçiminizə uyğun 16 elan tapıldı";
  * `/kateqoriyalar/agaclar` contains its 9 cards and the seller page its 6;
  * `/xidmetler` contains its 6 service cards and the home page every section;
  * the listing page contains title, price, specs, description, seller and related listings.
* **Head:** `<title>`, description, canonical, robots, Open Graph and Twitter tags are in `<head>`, with a browser
  user agent, on static and dynamic routes.
* **JSON-LD:** BreadcrumbList + Product on the listing page.
* **Staging behaviour:**
  * `X-Robots-Tag: noindex, nofollow` and the security headers and CSP are on every response;
  * `robots.txt` is `Disallow: /`, and `sitemap.xml` is empty.
* **Link crawl:** starting at `/` and following every internal `<a href>` in the server HTML, 56 pages and 74
  image/`srcset` URLs were checked. All return 200.

### 5.2 Visual parity

* **Method.** The same Playwright matrix used for the accepted build: 20 screens × 1440 / 768 / 390, guest and
  signed-in screens, full-page screenshots. Each was compared with the Vite baseline screenshots of `a1fbc77`.
* **Result: 60 / 60 screenshots are pixel-identical** (0 changed pixels; all 60 PNG files are byte-identical).

### 5.3 Hydration and console

* **Pages checked.** 36 URLs × guest and signed in × 1440 and 390, on both the production build and `next dev`:
  * every route, including filtered catalogue, category, seller-tab, list-view and 404 URLs;
  * the owner preview of a pending listing and of an unknown slug.
* **Result:** no hydration errors, no console errors or warnings, no failed requests, no broken images. The only
  console messages are Chromium's "404" log lines for the intentional 404 documents, which the script filters out.

### 5.4 Interaction suites

The existing Playwright scripts were pointed at `next start`.

| Suite | Result |
| --- | --- |
| Cross-page flow: guest prompt → login with `next` → wizard validation → submit → cabinet "Yoxlamada" → the cabinet links to the owner preview, which shows it, while its public URL is a 404 → moderator approves → "Aktiv" → favourites → header search → listing → seller | 15 / 15, including the first run on a cold cache (§5.6) |
| Wizard: validation, deep links, service variant, draft persistence, stale blob cleanup, guest submit → login | all passed |
| Admin: moderation queue, filters, sort, decisions, categories CRUD, complaints workflow and dialogs | 61 / 61 |
| Services catalogue and detail: search, categories, tabs, sort, pager, favourites, share, phone, complaint, 404, mobile bar | all passed |
| Listing and seller pages: gallery keyboard, favourite, share, phone and WhatsApp, complaint validation, all 16 public listings render, 404s. Owner preview: sign-in prompt for guests, public URL 404 for the owner, preview 200 + noindex with pending and expired notices, cabinet link rule. Seller tabs, search, sort, pagination, mobile bar | all passed |
| Sign-out from header, drawer and cabinet | 7 / 7 |
| Persistence after reload: favourites, session, banner, header `?q=`; category card → category page → view toggle → chip removal | 10 / 10 |
| Header search with and without JavaScript | 6 / 6 |

Script changes for Next.js:

* Some steps now wait for the URL, because App Router navigation is asynchronous.
* The two `import('/src/…')` calls, which only worked on the Vite dev server, were replaced.
* The pager count now counts links.
* One selector was stale since `a82bd34` and now targets the "Qərar tarixçəsi" notice.
* The services search selector is scoped to `main`. Since the header search gained `name="q"` for its no-JavaScript
  fallback, the bare `input[name=q]` matched the header box first.

These Playwright scripts live outside the repository, as in PR #1. Adding `@playwright/test` and committing them for
CI is still the recommended next step.

### 5.5 Loading frames and header state before hydration

* **Method.** Each private page × 1440 / 768 / 390 was loaded twice:
  * with the Next.js JavaScript blocked, which freezes the pre-hydration frame (inline scripts still run);
  * normally.

  The two `main` heights and the header's account area were compared.
* **Results:**

  | Page | Height difference |
  | --- | --- |
  | Dashboard | 0 / 0 / 22 px |
  | Profile | 0 at every width |
  | Wizard steps 1–6 | ≤ 1 px at every width |
  | Favourites | 0 / 24 / 38 px (long titles wrapping) |
  | Guest sign-in prompts | 0 |

  * The owner preview's skeleton covers the first screen; its related-listing sections below the fold are not
    reserved.
  * The confirmation page and the moderation queue use a generic skeleton. Their frames have no footer, so nothing
    below them moves.
* **Header before hydration:** shows "Elvin Əliyev · Çıxış" (or "Daxil ol" for guests) on every page and width.
  The dismissed demo banner stays hidden from the first paint.
* **CLS** during a normal local load: 0 on every page.

### 5.6 Intermittent 404 during end-to-end tests — root cause

* **Request:** `GET /elanlar/test-servi-e2e-150-sm-10525?_rsc=…` with `rsc: 1`, `next-router-prefetch: 1` and
  `next-router-segment-prefetch: /_tree`. This is the route-tree prefetch that `<Link>` sends when a link enters the
  viewport.
* **Initiator:** the cabinet row of the ad the test had just submitted. That ad exists only in the browser, but its
  row linked to the public URL `/elanlar/<slug>`.
* **Why it 404'd and why only sometimes:**
  * Next.js renders unknown `[slug]` params on demand and stores the result in its route cache
    (`.next/server/route-cache`).
  * The first prefetch of an uncached slug returns **404**, and Chromium logs a console error. Later prefetches are
    served from the cache with 200; the document itself stays 404.
  * The test always creates the same slug (fixed title, deterministic listing number). So only the first run after
    each `next build`, which clears the cache, hit the 404. That matches the 2 failures in about 30 runs; both were
    first runs after a rebuild.
* **Reproduction:** deterministic with a never-seen slug: 404 on the first visit, 200 on the second.
* **Fix:** the app no longer links to URLs that are 404 by design. Cabinet rows of unpublished and browser-only
  listings link to the owner preview, which is rendered per request (`connection()`) and never cached per slug.
* **After the fix:**
  * first run on a freshly built server: 15 / 15, no 4xx responses, no console errors;
  * the never-seen-slug probe now prefetches `/kabinet/elanlar/<slug>` with 200.

## 6. Known limitations and next steps

1. **SEO stays off** until the API replaces the sample data. Then follow the launch checklist in
   `SEO_ARCHITECTURE.md` §9.
2. **CSP** allows `'unsafe-inline'` scripts, which Next.js needs for inline RSC payloads. A nonce-based CSP needs
   `proxy.ts` plus dynamic rendering.
3. **`next/image` is deferred.** The exact Figma art direction (`<picture>` with per-breakpoint photos) is kept. Adopt
   it with an object-storage loader once uploads exist.
4. **`braces` dev-only advisory.** It goes away when `eslint-config-next` updates its glob dependency.
5. **Dynamic catalogue pages render per request.** With the real API, add data caching or `revalidate` per endpoint.
6. **Owner preview data** comes from `localStorage` (demo), so the route answers 200 for any slug and decides in the
   browser. With real auth it becomes an authenticated server request, which can return 404/403 directly.
7. **On-demand route cache for unknown listing slugs.** Any `/elanlar/<random>` request renders on demand and leaves an
   entry in Next.js's route cache, with the document still 404 (§5.6). With mock data every public slug is known at
   build time, so `export const dynamicParams = false` on `/elanlar/[slug]` and `/xidmetler/[slug]` would stop this.
   I left it on because new API listings will need on-demand rendering. Decide together with the API caching
   strategy (`revalidate`, platform cache limits).
8. **Skeleton sizing follows the default demo state.** A visitor with more or fewer listings or favourites than the
   demo seller sees the content grow or shrink once, below the first rows.
9. **Before hydration, buttons need JavaScript.** Links work as plain links from the first paint, but buttons such as
   "Çıxış" and the wizard's "Davam et" respond once the page has hydrated, usually within a moment.
