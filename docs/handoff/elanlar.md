# Catalogue (/elanlar), Variant 2 — summary of 6 November 2026

For: management and Ruslan (backend). Branch `nextjs-migration`. Before/after screenshots: [docs/design/elanlar/](../design/elanlar/README.md).

## In short

- `/elanlar` and the category pages (`/kateqoriyalar/…`) now look and behave like the Variant 2 home page:
  - one search field;
  - on desktop, filters in a column beside the results;
  - on phones, filters in the same «Filtrlər» sheet as on home;
  - results update as soon as a filter is picked.
- The listing card is redesigned everywhere it appears: home, catalogue, listing page, seller page, «Seçilmişlər».
- No backend change is needed today. The category and city counts come from extra searches on the sample data. A
  facet response from the API would replace them (see below).
- Checks on the last commit: lint, typecheck, 154 unit tests and the production build pass. The automated
  accessibility check (axe-core, WCAG 2.2 AA) finds no violations in 9 states at 1440 and 390 px:
  - default, filters set, sheet open (390 only), no results, list view.
  - Two kinds of item still need a manual look. One is a closed dropdown's hidden list, which is how the WAI-ARIA
    pattern works. The other is text that sat under the phone's bottom bar while the screenshot was taken.

## What changed on screen

- **Header:** the home header on the catalogue pages and on `/xidmetler`.
  - «Məhsullar» (or «Xidmətlər») is marked as the current section.
  - The header hides while you scroll down, as on home.
  - The header has no search field there, so each page has one search only.
- **Search card:** the home search card without its tabs: search word · city · «Axtar».
  - It replaces «Elanlarda axtarış».
  - One city at a time. Older links with several cities still work.
- **Heading:** names what is shown, in the words that led there: «Məhsullar», «Ağaclar», «Meyvə ağacları»,
  «Bakıda ağaclar», «Önə çıxan elanlar», ««zeytun» üzrə elanlar».
  - «16 elan» appears once, next to it (it was shown three times).
  - The heading is also the page title, e.g. «Bakıda ağaclar — GreenStore». No two indexable catalogue pages share a
    title; a test checks this.
- **Desktop, 1280 px and up:** a filter column beside the results.
  - Categories with counts; sub-categories open under the chosen one.
  - Price presets plus min/max, height and age (plants only), species, seller, «Çatdırılma» and «Önə çıxanlar».
  - Every choice applies at once. The old results stay and fade slightly while the new ones load: no skeleton, no
    jump.
  - The column stays in view while you scroll.
- **Phones and tablets:**
  - A bar with «Filtrlər (n)», sort and view sticks under the header and takes its place when the header hides.
  - «Filtrlər» opens the home sheet. Changes there wait for «N elanı göstər», and the number updates as you pick.
  - At 0 the button says «Uyğun elan yoxdur».
- **Active filters:** one removable chip per filter, including delivery and the search word, then «Sıfırla».
  - «Sıfırla» clears the filters and keeps the search word.
  - After you remove a chip, keyboard focus moves to the next one.
- **Sort and view:**
  - Sort uses the site dropdown (the phone's own picker on phones); the grid/list toggle uses icons.
  - Both are hidden when nothing matches.
- **No results:** «Bu seçimə uyğun elan yoxdur» plus up to three ways out, with counts, for example
  `«100 ₼-a qədər» olmadan: 4 elan`. Then «Filtrləri sıfırla», or «Bütün elanlara bax» when only the search word is
  set.
- **Listing card:**
  - Photo 4:3 (square on phones); price 21 px bold forest (17 px on phones); title on two lines (one on phones).
  - Details, then «Bakı · 3 həftə əvvəl» on desktop and the city only on phones.
  - «Önə çıxan» badge with the rocket.
  - Heart: a 44 px touch target, no longer inside the card link.
  - Cards in a row have equal heights.
  - List rows keep the full date and put the price in its own right-aligned column.
- **Loading:** a skeleton with the page's shape while the catalogue page itself is loading. Filter changes never show
  it.
- **Page links:** 44 px, the current page in forest, «Növbəti ›». These also apply on `/xidmetler`.
- **Removed:**
  - the old filter panel (10 dropdowns, among them a «Mövcudluq» that did nothing);
  - its separate sheet;
  - the multi-city picker;
  - the «Daha çox seçim axtarırsınız?» note.

## Decisions taken with management

| | Decision |
|---|---|
| D1 | «Önə çıxan» with the rocket, one badge component everywhere |
| D2 | Filter column from 1280 px; below it, the bar and the sheet |
| D3 | Home header on the catalogue pages and `/xidmetler` |
| D4 | Counts shown now, through the repository, behind one function (`getFacetCounts`) |
| D5 | Filters the backend cannot apply yet are hidden on home and in the catalogue (`SHOW_PENDING_FILTERS = false`) |
| D6 | Relative date on desktop cards, none on phone cards, the full date in list rows |
| D7 | New headings are also the page titles, each ending in « — GreenStore», none repeated |
| D8 | One city at a time; older multi-city links keep working |

## Commits

| Commit | What it does |
|---|---|
| `0911204` copy | promoted listings renamed «Önə çıxan elanlar» / «Önə çıxanlar» / «Önə çıxan», with a rocket icon |
| `2dcd476` chore | Playwright CLI skill for browser checks |
| `ed9899b` refactor | one filter model, the chips and price fields, and the «Filtrlər» sheet are shared by home and the catalogue; wording fixed |
| `3e02bcb` feat(cards) | the Variant 2 listing card and list row |
| `2aee035` feat | home header and the search card on the catalogue pages |
| `b45f1fa` feat | home header on `/xidmetler` |
| `6b81fdf` feat | filter column, heading and count, active filters, sort and view, instant results |
| `25f97ee` feat | phones and tablets: the sticky bar and the «Filtrlər» sheet with a live count |
| `99d1acb` feat | no-results suggestions, loading skeleton, page links; old filter components removed |
| `f9ed2a8` test | counts and the sheet's live count |
| `670c165` fix(a11y) | the «Filtrlər» button says its count in words without a separate label |

## URL parameters

The names did not change; they are listed in `PARAM` in `src/features/search/filterDefs.ts` and in
[categories.md](categories.md).

- **Height (`hundurluk`):** uses the home ranges `-100`, `100-200`, `200-300`, `300-` (cm). Older ranges such as
  `80-200` still filter and show as «80–200 sm».
- **City (`seher`):** one city. A comma list from an older link still works and shows as «Bakı, Abşeron».
- **Page links:** filters, the search word and the page number add a history entry, so Back undoes them. Sort
  (`siralama`) and view (`gorunus`) replace the entry instead. Any filter change returns to page 1.

## Pending on the backend (Ruslan)

1. **Facet counts.** `getFacetCounts` (`src/features/search/facets.ts`) makes about 20 `searchListings` calls per
   page: categories, sub-categories and cities, each with the other filters kept. The no-results suggestions make one
   more call per filter. Proposal: the search response returns these counts, or a facet endpoint takes the same
   parameters. This is a contract change, so nothing changes until you agree. Then only this function changes.
2. **Count for the sheet.** «N elanı göstər» calls `countCatalog` (`src/features/search/countAction.ts`, a Server
   Function). Today it runs a search with one result per page and reads the total. A count field or endpoint would be
   cheaper; the facet response from item 1 would also do.
3. **Filters still waiting:** `kok`, `movcudluq`, `ekin` and `catdirilma` on services ([categories.md](categories.md)).
4. **«Hamısı» search** still opens `/elanlar` only; services need a combined results page or one API search.
5. **Species and sub-categories.**
   - «Növ» (`nov`) is derived from the listing titles and «alt» from sub-category names in the sample data.
   - The API needs a species field and sub-category ids that the filter can use.
6. **City.** The search card sends one `seher` id. Please confirm that the API takes one id and tolerates an older
   comma list, or tell us to drop the list.

## Differences from the home page style

These are deliberate:
- **Filter placement.** On desktop the filters sit in a column with the options visible, not in chips with
  pop-ups.
- **Category list.** Categories appear as a list with counts instead of the home row of icon tiles.
- **Active filters** are forest-filled chips like home's, plus «×».
- **Heading size.** The heading is 28 px (22 px on phones), a page heading rather than the 44 px home hero.
- **No reveal animation on results.** It would replay on every filter change and delay what people came for.
- **Search card without tabs.** The catalogue has products only.
- **Sort and view controls.** They have bordered 44 px fields, because they stand on their own; home has no
  equivalent.

## Known gaps and follow-ups

The full list is in [follow-ups.md](follow-ups.md).

- **Sample data in the browser.** The listing page, the seller page, «Seçilmişlər», the cabinet and the post-ad wizard
  still load the sample listings in the browser. The catalogue and home no longer do. This goes away when those pages
  use the API.
- **Seller page sort.** The seller page keeps its own sort control (a native select); it was not changed.
- **`/xidmetler`** has only the header so far.
  - Still to do in their own step: its search form, selects, category buttons, sort, cards, no-results state, and the
    old title «Landşaft və bağçılıq xidmətləri».
- **Page links** do not dim the results while the next page loads (the filters do).
- **Gap above a short filter column.** When the filter column is shorter than the window and the header hides, a
  76 px gap shows above it.
- **Screen reader pass** (NVDA / VoiceOver) is still to do.
