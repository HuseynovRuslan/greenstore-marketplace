# Follow-ups

A running list of known gaps from the Variant 2 work (home, then the catalogue) that were left out of a step on
purpose. Kept up to date as steps land; remove an item when it is done.

## Copy that still uses the old category names

- **`/xidmetler` title and breadcrumb** say «Landşaft və bağçılıq xidmətləri», while the category is now «Bağ xidmətləri».
  Sources: `src/app/(main)/xidmetler/page.tsx` (metadata title), `src/views/ServicesPage.tsx` (`servicesCrumbs`, heading).

## Design

- **`/xidmetler`** has the home header only ([elanlar.md](elanlar.md)). Its own step still covers:
  - the search form and the «Xidmət ərazisi seçin» select;
  - the category buttons and the sort control;
  - the service cards and the no-results state.
- **Page links** do not dim the results while the next page loads; filter changes do.
- **Filter column gap:** when the sidebar is shorter than the window and the header hides, a 76 px gap shows above it.

## Accessibility

- **Targets under 44 px** (audit of 5 Nov, item 6). All of them meet the WCAG 2.5.8 minimum of 24 px, but not the
  44 px the project aims for. The favourite button is done (44 px since the card step). Still under 44 px:
  - section links («Bütün elanlara bax», «Bütün xidmətlər», «Biznes satıcıların elanları») 20 px tall;
  - footer links 17 px tall;
  - bottom-nav items 40 px.
- **Screen reader pass:** nothing has been checked with NVDA or VoiceOver yet; so far only axe-core and keyboard checks.

## Backend (Ruslan) — see [categories.md](categories.md)

- Proposed params for the pending filters: `kok`, `movcudluq`, `ekin`, and `catdirilma` on services.
- **«Hamısı» searches only `/elanlar`**, so services are left out of its results. A combined results page (or API
  support for one search across products and services) is needed; discuss with Ruslan.
- Real sub-categories for `kollar` and `otaq-bitkileri` (the current lists are placeholders).
- Redirects for the removed category URLs `/kateqoriyalar/dekorativ-bitkiler` and `/kateqoriyalar/dibcekler-dekorasiya`.
- Category and city counts from the API instead of `src/data` (contract change). The catalogue's counts sit behind
  `getFacetCounts` (`src/features/search/facets.ts`), and the sheet's count behind `countCatalog`; see
  [elanlar.md](elanlar.md).
- Species (`nov`) and sub-category (`alt`) filters need API fields; today they are derived from the sample data.
- **Price 0 — «Razılaşma ilə»?** `Listing.price` is a plain number, so a listing without a fixed price would show
  «0 ₼» on cards and rows (`formatPrice`, `src/lib/format.ts`). Does the API send 0 for "price on request"? If so,
  the UI should show «Razılaşma ilə» instead, and the contract needs a way to say it (a nullable `price` or a
  `priceType` field). No UI change until this is decided. (Found with `/dev/worst-case`, Nov 2026 polish pass.)
- **Search word length.** The search fields now stop at 100 characters (`QUERY_MAX`,
  `src/features/search/filterDefs.ts`); before, a pasted phrase made the search chip wider than a phone screen.
  What is the longest `q` the API accepts? Links can still carry a longer `q`; the chip truncates it.

## Data in the browser

- The listing page, the seller page, «Seçilmişlər», the cabinet and the post-ad wizard still import the sample
  listings in client code. The catalogue and home no longer do: client components use the data-free
  `searchUrl.ts`, `taxonomy.ts` and `services/listingSort.ts`. Server-only code uses `searchState.ts` and
  `species.ts`.
