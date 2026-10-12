# GreenStore — implementation report

This report covers the frontend implementation of the approved Figma design (file `uYNd146nDVjM8uLJoeY6NT`), with
the prototype wordmark "YARPAQ" replaced by **GreenStore**. The design audit is in [`FIGMA_AUDIT.md`](FIGMA_AUDIT.md).

**Summary.**
* All 25 Figma frames are implemented: 22 screens, 3 of them also at tablet and mobile width, and the components sheet
  as the shared component library.
* There are 18 route paths, 95 extracted images and typed mock data copied from Figma.
* Typecheck, lint, unit tests, production build, a route smoke test (26 routes × 3 widths × guest/signed in) and a
  cross‑page end‑to‑end flow all pass.
* Every frame was screenshotted and compared with its Figma render. The comparison images are in
  [`docs/verification/`](docs/verification).

No backend was built (as requested). All behaviour runs on local mock state.

---

## 1. Implemented screens

| Figma frame | Route | Notes |
| --- | --- | --- |
| Ana səhifə · 1440 / 768 / 390 | `/` | Header with section row, hero search, categories, VIP, latest ads, services, sellers, safety band, footer; tablet and mobile layouts; mobile bottom navigation |
| Məhsul axtarışı · 1440 | `/elanlar` | Filter sidebar, chips, grid/list view, sort, empty state, hint |
| Mobil filtr paneli · 390 | `/elanlar` (<1280 px) | Bottom sheet with draft filters and a live "N elanı göstər" count |
| Zeytun ağacı · 1440 | `/elanlar/:slug` | Works for all 16 public listings and the owner's pending/expired ads; sticky contact bar on mobile |
| Abşeron Tingçilik · 1440 | `/saticilar/:slug` | Banner, contact, category tabs, in‑seller search, sort, paging |
| Xidmətlər · 1440 | `/xidmetler` | Search, area, category tiles, provider tabs, sort, paging |
| Landşaft dizaynı · 1440 | `/xidmetler/:slug` | All 6 services; gallery and lightbox, portfolio, contact |
| Daxil ol · 1440 | `/daxil-ol` | Phone/e‑mail tabs, validation, the Figma error alert, `?next=` redirect |
| Qeydiyyat · 1440 | `/qeydiyyat` | Fərdi/Biznes, conditional fields, password mismatch error, consent |
| Şəxsi kabinet · 1440 | `/kabinet` | Stats, status tabs, deactivate/renew/activate, 7‑day chart; sign‑in prompt for guests |
| Profil məlumatları · 1440 | `/kabinet/profil` | Profile form, password change, notifications, public profile card |
| Seçilmişlər · 390 | `/secilmisler` | Listings and services, filter tabs, remove, empty state; adapted for wider screens |
| Elan yerləşdir · 1–6 | `/elan-yerlesdir/:step` | Wizard with stepper, summary, per‑step validation, photo upload, preview, submit |
| Elan yoxlamaya göndərildi | `/elan-yerlesdir/gonderildi` | Shows the ad just submitted |
| İdarəetmə · Moderasiya | `/idareetme/moderasiya` | Queue (includes ads submitted through the wizard), approve or reject with a reason |
| İdarəetmə · Kateqoriyalar | `/idareetme/kateqoriyalar` | Search, add and edit with validation, active/inactive |
| İdarəetmə · Şikayətlər | `/idareetme/sikayetler` | Status filter, decisions with history, confirmation dialog |
| Vizual komponentlər və vəziyyətlər | — | Implemented as `src/components/ui/*`: Button states, Field states, Badge, Notice, Panel, Dialog, EmptyState, Skeleton, cards, mobile nav |

There is also a not‑found page for unknown routes, listings, sellers and services.

## 2. Visual verification

**Method.**
1. Every frame was rendered from Figma at 1x (`get_screenshot`).
2. The matching route was screenshotted with Playwright at the frame width, with the same state: signed in for account
   and wizard pages, and the Figma filter URL for search.
3. Mean absolute pixel difference was measured over the overlapping height. Side‑by‑side images were reviewed by eye.

The table shows the final run.

| Frame | Figma | Impl. height | Δ height | Mean pixel diff (0–255) |
| --- | --- | --- | --- | --- |
| home‑1440 | 1440×3900 | 3903 | +3 | 3.8 |
| home‑768 | 768×4623 | 4625 | +2 | 7.4 |
| home‑390 | 390×7424 | 7419 | −5 | 14.4 |
| search‑1440 | 1440×1582 | 1566 | −16 | 3.1 |
| listing‑detail‑1440 | 1440×2595 | 2584 | −11 | 10.4 |
| seller‑1440 | 1440×2150 | 2134 | −16 | 3.4 |
| services‑1440 | 1440×1960 | 1944 | −16 | 4.9 |
| service‑detail‑1440 | 1440×2331 | 2314 | −17 | 4.2 |
| login‑1440 | 1440×1024 | 900 † | — | 3.9 |
| register‑1440 | 1440×1350 | 1309 | −41 ‡ | 6.7 |
| dashboard‑1440 | 1440×1861 | 1845 | −16 | 1.7 |
| profile‑1440 | 1440×1825 | 1809 | −16 | 1.9 |
| favorites‑390 | 390×1883 | 1864 | −19 | 11.2 |
| post‑ad‑1 | 1440×1024 | 913 † | — | 3.6 |
| post‑ad‑2 … 6 | 1440×1135–1516 | | −1 … +2 | 2.9–4.6 |
| post‑ad‑submitted | 1440×1024 | 900 † | — | 1.9 |
| admin‑moderation | 1440×1763 | 1737 | −26 ‡ | 3.4 |
| admin‑categories | 1440×1493 | 1488 | −5 | 3.4 |
| admin‑complaints | 1440×1277 | 1277 | 0 | 3.1 |

**How to read the numbers**
* **Constant −15/−16 px on inner pages.** Every Figma inner‑page frame ends with an empty 15 px text node below the
  footer, an export artifact. That spacer and the 1 px header stroke account for it; the content itself lines up within
  1–2 px.
* **† Shorter Figma frames.** These frames are a fixed 1024 px tall, taller than their content. The screenshot is the
  900 px viewport.
* **‡ Error states shown on load in Figma.** Figma shows the error state in the static frame. In the app it appears
  after an invalid submit (register: password mismatch; moderation: the missing reason). The states themselves match
  pixel for pixel once triggered.
* **Higher diffs** (listing detail, favourites, home‑390) come mainly from text wrapping where "GreenStore" is longer
  than "YARPAQ", from WebP re‑encoding of photos, and from small vertical drift on long mobile pages.

## 3. Preserved assets

* **95 of 95 unique Figma images** are extracted to `public/images/**` as WebP (2.2 MB). The node‑to‑file mapping is in
  [`docs/figma/image-manifest.json`](docs/figma/image-manifest.json).
* **Image-to-listing links are kept.** Each listing carries every photo Figma attaches to it, in frame order:
  * `cover`, `coverTablet` and `coverMobile` are the 1440, 768 and 390 card photos. `ListingCard` serves them through
    `<picture>`, so each breakpoint shows the photo of the matching frame.
  * `images` is the gallery.
  * `thumbnail` is the cabinet thumbnail.
* **Page-specific photos.** The search, "Oxşar elanlar"/seller grids and service pages use the exact photos of their
  frames.
* **No external images.** Nothing references Figma URLs, stock photos or placeholders.
* **Icons.** Lucide glyphs with the same names, sizes and stroke weights as the Figma layers.
* **Export quality.** Every export was diffed against its region of the full‑frame render. Six search‑frame exports were
  wrong (half‑blank or zoomed), so they were re‑cropped from the frame render; see FIGMA_AUDIT §6.

## 4. Preserved original data

The typed modules in `src/data/` (`listings`, `services`, `sellers`, `categories`, `cities`, `user`, `dashboard`,
`postAd`, `admin`) contain the Figma content verbatim:
* 16 public listings and 2 of the seller's own, with prices, attributes, cities and dates. Zeytun ağacı also has its
  full specifications and description.
* 6 services with the Landşaft dizaynı details and portfolio.
* 3 sellers and 5 service providers.
* 10 categories with counts, and the service categories.
* Cities, cabinet statistics and chart, the wizard's example draft, the moderation queue, the category admin fields,
  and complaints with their history.

Where Figma doesn't state a fact, the app shows less rather than inventing it. Listings without a known seller say
"Satıcı məlumatı göstərilmir" and disable contact. FIGMA_AUDIT §6.5 lists the inferred fields (category per listing,
the "Dekorativ ağaclar" subcategory).

## 5. Functional interactions (local state, no backend)

* **Navigation:**
  * Header search follows `?q=` and searches services while you are on `/xidmetler`.
  * Section links, cards → detail → seller page, breadcrumbs.
  * Mobile drawer menu and the 5‑item bottom navigation.
  * Lazy‑loaded routes; the page scrolls to top on navigation and to `#hash` targets.
* **Search:**
  * Filters kept in the URL: query, category, subcategory, species, multi‑city, price range with validation, height,
    age, delivery, seller type, VIP.
  * Removable chips, "Hamısını təmizlə", sort, grid/list toggle, empty state.
  * Mobile/tablet bottom sheet with focus trap, scroll lock and Escape.
* **Favourites:**
  * Heart toggle on every listing card, the detail page and service pages.
  * `/secilmisler` with tabs and removal.
  * Guests keep their own list; the demo account is seeded with the five Figma items.
* **Listing and seller pages:**
  * Gallery (thumbnails, arrow keys) and service lightbox.
  * "Nömrəni göstər" reveal (`tel:` link) and WhatsApp (`wa.me`).
  * Share: the share sheet, or copy the link with a confirmation.
  * Complaint dialogs with validation.
  * Seller tabs, search, sort and paging.
* **Auth (mock):**
  * Login with phone/e‑mail validation and the Figma error alert.
  * Registration with conditional business fields and password match.
  * `?next=` redirects; sign‑in prompts on protected pages; "Çıxış" sign‑out.
* **Cabinet:**
  * Status tabs, and deactivate (confirmation dialog), renew and activate; stats and tab counts update and persist.
  * 7‑day chart.
  * Profile save with notice, password change and notification preferences.
* **Ad posting:**
  * 6 steps with a persisted draft and per‑step validation, focusing the first invalid field.
  * Product/service variants.
  * Photo upload by picker or drag & drop: 10 MB limit with the Figma error notice, 10‑photo limit, set cover, delete.
  * Live summary, preview, then submit to the moderation queue, then the confirmation page.
  * Signed‑out submit is redirected to login with the draft kept.
* **Moderation:**
  * Approving or rejecting an ad submitted through the wizard updates the seller's cabinet (pending → active/rejected).
  * Category editing with duplicate‑name and order validation.
  * Complaint decisions are appended to the history.

## 6. Build and test results

| Check | Result |
| --- | --- |
| `npm install` / `npm ci` | OK, `npm audit`: 0 vulnerabilities. Vitest was upgraded from 3.2 to 4.1.11 to clear 3 advisories (2 critical, 1 moderate) in `vitest`, `tinypool` and `@vitest/mocker`. The lockfile was regenerated with npm 11 because npm 10.9.4 crashes (`edgesOut`) when it resolves Vitest 4's optional peers without a lockfile. With the committed lockfile, `npm install` and `npm ci` work on npm 10 |
| `npm run typecheck` (`tsc -b`, strict) | 0 errors |
| `npm run lint` (ESLint, typescript‑eslint, react‑hooks) | 0 errors, 0 warnings |
| `npm test` (Vitest 4 + Testing Library) | 4 files, 17 tests passed: formatting, search/filter logic (reproduces the Figma result set and order), services query, home page render, favourites toggle, hero search validation and navigation |
| `npm run build` | OK. Main chunk 375 kB (119 kB gzip), CSS 42 kB (8.6 kB gzip), 35 lazy route chunks |
| Route smoke test (Playwright; dev server and production `vite preview`) | 26 routes × 1440/768/390 × guest/signed in: no console errors, failed requests, broken images, horizontal overflow or leftover "YARPAQ" text |
| Cross‑page end‑to‑end flow (Playwright) | 12/12 checks |
| Per‑screen interaction scripts (Playwright, written while building each area) | All passed: search 47 checks, detail/seller 70, services ~60, account 68, wizard flow plus the service variant, admin 61 |

The end‑to‑end flow covers:
1. A guest is prompted to sign in on the cabinet.
2. Login redirects to the cabinet.
3. Step 2 of the wizard is fixed, the title is edited, and the ad is submitted.
4. The ad appears as "Yoxlamada" in the cabinet.
5. The moderator approves it, and it shows as "Aktiv".
6. A favourite set on the home page appears on `/secilmisler`.
7. Header search filters the catalogue.
8. The detail page links to the seller profile.

The Playwright scripts ran against the globally installed Playwright in the build environment and are not part of the
repository, to avoid adding a dependency. See "Recommended next steps".

## 7. Unresolved differences

1. **Image sharpness.** The 95 images are 1x renders at the size Figma displays them, because `www.figma.com` was
   blocked in this environment. They are slightly soft on high‑DPI screens, and gallery photos that Figma only uses as
   302×110 thumbnails are upscaled when shown large.
2. **Interactive defaults instead of Figma's static states.**
   * Figma's moderation sort label "Əvvəl ən köhnələr" contradicts its newest‑first list. The default is
     "Əvvəl ən yenilər", and the oldest‑first option really sorts oldest first.
   * No complaint chip is active on load, because Figma marks "Açıq · 7" active but lists every status.
   * The first service category tile isn't pre‑selected, because tiles are real filters.
   * The registration form starts empty, with the Figma values as placeholders.
   * The step‑2 height‑range error is shown on load, because the example draft keeps Figma's "120–100".
3. **Data volume.** Pagination shows a single page wherever the data has ≤ 6 items (Figma: "1 2 3 Növbəti"). The
   "Fərdi ustalar" tab is empty because Figma never marks a provider as individual. Tab counts keep the Figma totals.
4. **Branding length.** "2021‑dən GreenStore‑da" wraps in the detail page's seller panel, so the page is about 13 px
   taller there.
5. **Checkboxes.** These are real checkboxes in the brand colour, where Figma uses ☐/☑ text glyphs.
6. **Search sidebar defaults.** "Alt kateqoriya", height and age selects default to "all". Figma shows "Dekorativ
   ağaclar / 80–200 sm / 2–5 yaş" selected with no chips for them. Adding `&alt=…&hundurluk=80-200&yas=2-5` reproduces
   the same 6 results, with extra chips.
7. **Responsive adaptations.** Screens without tablet or mobile frames are adapted from the same components (stacked
   columns, 2‑column card grids, sticky contact bars). They were checked for overflow and console errors, but there is
   no Figma reference to compare against.

## 8. Copy added for interactivity (not in Figma)

Every added string is Azerbaijani and kept short. Interaction labels:
* Sort options other than "Ən yenilər".
* "all" options for selects.
* Validation messages other than those shown in Figma.
* Empty states and not‑found pages.
* Share, copy and complaint confirmations.
* "Çıxış".
* "Deaktiv" and "Dayandırılıb" badges.
* Admin history entries and the complaint reasons for dialogs.
* Accessibility labels (`aria-label`s).

The agents' reports were consolidated here; the strings live next to their components in `src/features/*` and
`src/data/*`.

## 9. Missing resources

* **Original high‑resolution images and SVG exports:** blocked host `www.figma.com`.
* **Tablet and mobile frames:** none for screens other than the home page, the mobile filter sheet and favourites.
* **Pages linked from the design that have no frame:** "Elan statistikası" (scrolls to the chart), "Bütün satıcılar"
  (links to business sellers' listings), footer "Dəstək" links, "Şifrəni unutmusunuz?" (shows a short notice) and
  admin "İstifadəçilər" (disabled).
* **Facts not in Figma:** sellers of most listings, specifications and descriptions beyond Zeytun ağacı / Landşaft
  dizaynı, and real phone numbers.

## 10. Recommended next steps

1. **Allow `www.figma.com`** in the environment's network access settings and re‑export the original 1024–1584 px
   photos from `docs/figma/image-manifest.json`. Then add responsive `srcset` sizes.
2. **Backend (ASP.NET Core 10 Web API).**
   * Implement the endpoints mirrored by `src/services/marketplace.ts` and the DTOs in `src/types`: listings search,
     listing/seller/service detail, auth, favourites, my‑listings, moderation, categories and complaints.
   * Replace the `src/data/*` lookups and the localStorage store (`src/app/store.tsx`) with a data‑fetching layer such
     as TanStack Query.
3. **Add Playwright (`@playwright/test`)** as a dev dependency and commit the smoke, end‑to‑end and visual comparison
   scripts so they run in CI.
4. **Consolidate the few remaining per‑feature helpers** into `src/components`: breadcrumb, sort select, pagination,
   checkbox and the services `InsetPanel` (now identical to `Panel`).
5. **Get the design team's decisions** on the Figma inconsistencies in FIGMA_AUDIT §6.6 and the open questions in §7,
   then confirm the copy added in §8.
