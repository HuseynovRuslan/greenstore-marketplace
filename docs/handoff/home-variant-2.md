# Home page, Variant 2 — summary of 5 November 2026

For: management and Ruslan (backend). Branch `nextjs-migration`. Mockups: `docs/design/variant-2/`.

## In short

- The home page now follows Variant 2. A first-time visitor sees what GreenStore is («Azərbaycanda bitki və bağ
  elanları») and can search straight away: products or services, a search word, a city and optional filters.
- «VIP elanlar» is now «Önə çıxan elanlar» across the site: «Önə çıxanlar» in the menu, the badge «Önə çıxan» on
  cards and a rocket icon next to the name. The mockups still show the earlier name; see
  [docs/design/variant-2/README.md](../design/variant-2/README.md).
- The page still runs on sample data. It works without backend changes, but the new filters and the counts need the
  backend items below before they can use real data.
- Checks on the last commit: lint, typecheck, 111 unit tests and the production build all pass. The automated
  accessibility check (axe-core, WCAG 2.2 AA) finds no violations at 1440 and 390 px.

## What changed on screen

- **Hero:** the heading on mint, then a white search card.
  - Tabs «Hamısı / Məhsullar / Xidmətlər» with listing counts.
  - Search word, city and «Axtar».
  - Filter chips: Kateqoriya, Qiymət, Hündürlük, Çatdırılma. «Kök sistemi», «Mövcudluq» and «Əkin daxil» are
    hidden until the backend has params for them (see below).
  - On phones: a scrolling chip row and a «Filtrlər» sheet.
- **Categories:** the ten categories (icon, name, count) sit in one row under the search, instead of a separate grid
  further down.
- **Önə çıxan elanlar:** 4 listings, a rocket icon next to the heading and the subtitle «Satıcıların ödənişlə irəli
  çəkdiyi elanlar». **Son elanlar:** 8 listings.
- **Header (home page only):** one row: logo · Məhsullar · Xidmətlər · Satıcılar · Önə çıxanlar (with the rocket) · ♡ · Daxil ol ·
  «Elan yerləşdir».
  - It hides while you scroll down and comes back when you scroll up. (Replaced 10 Nov 2026: transparent over the
    hero photo, then solid and always in view.)
  - Once the hero search is out of view, a short search field takes the place of the menu and leads back to it.
- **Motion:** the hero fades in, cards appear as you scroll, photos zoom slightly on hover and the heart "pops".
  None of it runs for visitors who ask their device for reduced motion.
- **Colours:** grey and olive text are a little darker, so all text meets the contrast minimum.
- **Accessibility:**
  - an «Əsas məzmuna keç» link on every page, shown when you press Tab;
  - clearer names for links and price fields;
  - the header menu can always be reached with the keyboard.
- **Since then (6 November):** the listing card follows the Variant 2 card. The catalogue pages and `/xidmetler`
  also use this header; see [elanlar.md](elanlar.md).

## Commits

| Commit | What it does |
|---|---|
| `91a9a98` copy | «VIP» replaced everywhere (by the mockup name, renamed again in the last row); new hero heading and subtitle |
| `30420f1` docs(design) | Variant 2 mockups added to the repository |
| `8b5bf45` chore | lint skips Claude tool scripts; a file-name clash that broke the build on Windows is fixed |
| `795affe` feat(tokens) | Variant 2 colours, corner radii, shadows and animation timings; darker grey text |
| `9bcb5d9` feat(data) | the 10 Variant 2 categories, city counts, 4 promoted and 8 latest sample listings |
| `73558ed` docs(handoff) | categories and pending filters for the backend ([categories.md](categories.md)) |
| `d363cc4` feat(data) | new shrub icon for «Kollar» |
| `0e4e2ae` fix(a11y) | darker olive for text on white, for contrast |
| `76f8b2b` docs(handoff) | follow-ups list ([follow-ups.md](follow-ups.md)) |
| `fe2abd9` feat(ui) | keyboard-friendly city dropdown and a shared popover panel |
| `aa4b2b6` fix(ui) | Tab picks the highlighted city, as the WAI-ARIA pattern prescribes |
| `bc4e054` feat(home) | hero search card: tabs, search word, city, «Axtar» and filter chips |
| `be98a71` feat(home) | phones: chip row, «Filtrlər» sheet, scrolling categories row |
| `fb498b6` feat(home) | categories grid, promoted listings section and the one-row home header |
| `526bae7` fix(home) | short search placeholders that fit on phones |
| `36c059e` feat(motion) | header hides and returns on scroll; search field in the header once the hero search is gone |
| `9fcb82b` feat(motion) | hero entrance, card reveal, photo zoom and heart pop |
| `e1d8916` fix(motion) | keyboard focus is no longer lost when the header search replaces the menu |
| `1130b38` fix(a11y) | audit fixes: link and price-field names, header menu reachable by Tab, skip link, demo banner landmark |
| `b64ccc3` docs(handoff) | this summary, plus two accessibility items added to the follow-ups |
| `1c907c4` | logo: smaller gap between the leaf and «GreenStore» from 768 px |
| `6c38eef` fix(home) | no focus ring around the hero search field when it is clicked (as in the mockup) |
| copy | promoted listings renamed «Önə çıxan elanlar» / «Önə çıxanlar» / badge «Önə çıxan», with a rocket icon |

## Pending on the backend (Ruslan)

Proposed names, values and the current URL parameters are in [categories.md](categories.md).

1. **New filters.** «Kök sistemi», «Mövcudluq», «Əkin daxil» and «Çatdırılma» for services are hidden for now
   (`SHOW_PENDING_FILTERS = false`, 6 November): the results page cannot apply them yet. The proposed parameters are
   `kok`, `movcudluq`, `ekin` and `catdirilma` for services. Please confirm the names and one set of values for both
   the filters and the post-ad form. After that, the frontend shows and sends them on home and in the catalogue.
2. **«Hamısı» search.** It opens `/elanlar`, so services are left out of the results. This needs a combined results
   page, or one API search across products and services.
3. **Counts.** The tab, category and city counts come from frontend sample data. Serving them from the API is a
   contract change: for example, counts in the home response or a facet endpoint.
4. **Categories.**
   - Real sub-categories for `kollar` and `otaq-bitkileri`.
   - Redirects (or not) for the removed `/kateqoriyalar/dekorativ-bitkiler` and `/kateqoriyalar/dibcekler-dekorasiya`,
     and a mapping for real listings that still use those ids.
   - The API must accept the new icon name `shrub`.

## Follow-ups (frontend)

The full list is in [follow-ups.md](follow-ups.md).

- **Listing card:** done on 6 November ([elanlar.md](elanlar.md)). Still to do: bring the section links, footer links
  and the bottom bar up to 44 px touch targets.
- **Old category names:** the `/xidmetler` title and the seller page tabs still use them.
- **Screen reader check:** a manual pass with NVDA or VoiceOver is still to do.
