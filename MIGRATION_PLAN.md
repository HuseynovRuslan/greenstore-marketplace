# GreenStore — Next.js migration plan

**Source.** Accepted React + Vite frontend, PR #1, branch `claude/upbeat-albattani-0klb4f`, commit `a1fbc77`.
**Target branch.** `claude/nextjs-migration`, created from `a1fbc77`. The Vite branch and PR #1 stay untouched.
**Delivery.** A new pull request into `main`. No merge or deploy without approval.

## 1. Audit of the accepted Vite app

| Area | Finding | Migration impact |
| --- | --- | --- |
| Size | ~11 k lines of TypeScript; 16 page components, 60 feature and shared modules, 95 WebP images | Moved, not rewritten |
| Routing | React Router 7, 18 route paths, 37 files import from `react-router`: `Link` (24 files), `useNavigate` (7), `useSearchParams` (6), `useLocation` (6), `useParams` (4), `NavLink` (2), `Navigate` (1), plus `location.state` in the wizard | Replace with `next/link` and `next/navigation`. Route params come from the server `page.tsx` as props |
| Page folder | `src/pages/*` | Next.js would treat it as the Pages Router, so rename it to `src/views/*` |
| App state | `src/app/store.tsx`: favourites, demo session and submitted ads in `localStorage`, read **during the first render** | Hydration mismatch risk. Move to `src/state/` and back the storage hook with `useSyncExternalStore`, where the server snapshot is the default and the client value applies after hydration |
| Other render-time storage reads | Demo banner (`sessionStorage`), wizard draft, confirmation page, cabinet rows | Same treatment: storage is only read after hydration |
| `document.title` | Set manually on the listing and seller pages | Replace with `generateMetadata` |
| Vite-only APIs | `import.meta.env.VITE_DEMO_MODE`; `import.meta.glob` in one test | Use `process.env.NEXT_PUBLIC_DEMO_MODE`. The test keeps `import.meta.glob`, because Vitest still runs on Vite |
| Rendering | 100 % client‑side rendering; no SEO metadata, sitemap, robots or structured data | The main gain of the migration (§3, §4) |
| Styling | Tailwind CSS 4 tokens in `src/styles/index.css`; `@tailwindcss/vite` | Same CSS file with `@tailwindcss/postcss`. Tokens unchanged |
| Images | Plain `<img>` and `<picture>` (art direction per breakpoint) from `/public/images` | Kept as is, so crops, sizes and breakpoint photos stay identical. `next/image` is deferred until user uploads come from object storage |
| Fonts | `@fontsource/inter` (self-hosted) | Kept. No build-time Google Fonts fetch |
| Tests | Vitest + Testing Library (33 tests), Playwright scripts outside the repo | Vitest kept; router-dependent tests use `next/navigation` mocks. New SEO unit tests. Playwright verification is re-run against `next start` |
| Vite‑only deploy config | `vercel.json` SPA rewrite, Vite preset | Removed. Next.js routing needs no rewrites; headers move to `next.config.ts` |

## 2. Target architecture

```
src/
  app/                       Next.js App Router (routes, layouts, metadata, robots.ts, sitemap.ts)
    layout.tsx               <html lang="az">, fonts, global CSS, providers, default metadata
    not-found.tsx            global 404 page
    (home)/                  "/" with the home header (section row) and full footer
    (main)/                  public catalogue, detail, seller and services pages, plus cabinet/favourites (82 px header + compact footer)
    (auth)/                  login, registration (header only)
    (workflow)/              ad-posting wizard (workflow header)
    (admin)/                 moderation tools (admin header)
  views/                     former src/pages: page bodies, split into server parts and client islands
  components/ features/      unchanged UI; `'use client'` only where hooks or browser APIs are used
  data/                      demo data (unchanged)
  services/                  data-access boundary: repository interface + mock implementation (async, server-safe)
  state/                     client state (favourites, demo session, submitted ads), hydration-safe
  seo/                       site config, metadata helpers, indexing rules, JSON-LD builders, sitemap builder
  config/                    demo flag
```

**Route map.** Every existing Azerbaijani URL is preserved.

> **Implementation note.** The category pages are rendered per request rather than prerendered, because they honour
> `?sehife=` (crawlable pagination), `siralama` and `gorunus`. Everything else follows this plan; the outcome is in
> MIGRATION_REPORT.md.

| URL | Rendering | Notes |
| --- | --- | --- |
| `/` | Static (SSG) | Server sections plus client islands (hero search, favourite buttons, header) |
| `/elanlar` | Dynamic (query) | Server results and pagination; client filter shell. Indexing rules in SEO_ARCHITECTURE.md |
| `/elanlar/[slug]` | SSG for public listings | Real 404 for unknown and non-public slugs. The client fallback shows the demo owner's own unpublished ads |
| `/kateqoriyalar/[kateqoriya]` | Dynamic (new; planned as SSG, see note) | Category landing page: same catalogue UI, clean canonical URL |
| `/kateqoriyalar/[kateqoriya]/[seher]` | Dynamic (new; planned as SSG, see note) | Category × city page; indexable only above an inventory threshold |
| `/saticilar/[slug]` | Dynamic (tab, search and page in the query) | Server profile; client listing filters |
| `/xidmetler`, `/xidmetler/[slug]` | Dynamic / SSG | Same split as the product pages |
| `/daxil-ol`, `/qeydiyyat`, `/kabinet`, `/kabinet/profil`, `/secilmisler`, `/elan-yerlesdir/*`, `/idareetme/*` | Client components rendered on the server; `noindex` | Private or demo state in `localStorage` |

## 3. Server and client split rules

* `page.tsx` files are Server Components. They read params and search params, load data through `src/services`,
  call `notFound()`, export `generateMetadata`, emit JSON‑LD, and render the view.
* Components without hooks stay shared, with no directive: cards, badges, panels, section headers, footer. They render
  on the server and can also be used inside client trees.
* `'use client'` is limited to the components that need it:
  * **interactive controls:** header, mobile nav, fields, dialogs, the filter shell, galleries, contact and share
    actions, favourite buttons;
  * **pages driven by local state:** account, wizard, admin.
* Client state never decides the server HTML. Storage‑backed values use a server snapshot (guest, empty), so
  hydration always matches and the client value applies right after.

## 4. Steps

1. Dependencies:
   * add `next@16.3.8` and `eslint-config-next`;
   * swap `@tailwindcss/vite` for `@tailwindcss/postcss`;
   * remove `react-router`, the Vite build config and `index.html`;
   * keep Vite and `@vitejs/plugin-react` only for Vitest.
2. Restructure: `src/pages` → `src/views`, `src/app/store.tsx` → `src/state/store.tsx`; delete `main.tsx`,
   `routes.tsx` and the scroll manager (Next.js restores scroll and handles `#hash`).
3. Replace router primitives across the 37 files. In the wizard, `location.state` becomes a small in‑memory flash store
   plus the existing "last submitted" value.
4. Make storage hooks hydration‑safe.
5. Build the route groups, layouts and pages; split the public pages into server parts and client islands.
6. SEO foundation: config, metadata, canonical and indexing rules, JSON‑LD, sitemap, robots, headers (see
   SEO_ARCHITECTURE.md).
7. Tests: adapt the Vitest suite and add SEO unit tests. Verify with the production build:
   * route smoke test, interactions, hydration errors;
   * HTML responses and the internal link crawl;
   * screenshot diff against the Vite baseline at 1440, 768 and 390.
8. Documentation (README, SEO_ARCHITECTURE.md, MIGRATION_REPORT.md) and a new PR into `main`.

## 5. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Hydration mismatches from `localStorage` | `useSyncExternalStore` with a server snapshot; Playwright checks every route for hydration warnings |
| Visual drift | Same CSS, tokens, markup and images. Pixel diff against the accepted Vite screenshots at three widths |
| Mock data indexed as real inventory | Indexing requires `SEO_INDEXABLE=true` **and** a non‑mock data source. Until then, robots meta and `X-Robots-Tag` say `noindex`, `robots.txt` disallows everything, and the sitemap is empty |
| `useSearchParams` turning static pages into client‑only rendering | Server pages read `searchParams` and pass state as props; client shells use the router only to navigate |
| Soft 404s | `notFound()` in the server pages; HTTP status checked with curl |
