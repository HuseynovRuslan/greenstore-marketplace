# Home page, Variant 2 — summary of 5 November 2026

For: management and Ruslan (backend). Branch `nextjs-migration`. Mockups: `docs/design/variant-2/`.

## In short

- The home page now follows Variant 2. A first-time visitor sees what GreenStore is («Azərbaycanda bitki və bağ
  elanları») and can search straight away: products or services, a search word, a city and optional filters.
- «VIP elanlar» is now «Bağ vitrini» across the site, with the badge «Vitrin».
- The page still runs on sample data. It works without backend changes, but the new filters and the counts need the
  backend items below before they can use real data.
- Checks on the last commit: lint, typecheck, 111 unit tests and the production build all pass. The automated
  accessibility check (axe-core, WCAG 2.2 AA) finds no violations at 1440 and 390 px.

## What changed on screen

- **Hero:** the heading on mint, then a white search card.
  - Tabs «Hamısı / Məhsullar / Xidmətlər» with listing counts.
  - Search word, city and «Axtar».
  - Filter chips: Kateqoriya, Qiymət, Hündürlük, Kök sistemi, Mövcudluq, Çatdırılma, Əkin daxil.
  - On phones: a scrolling chip row and a «Filtrlər» sheet.
- **Categories:** the ten categories (icon, name, count) sit in one row under the search, instead of a separate grid
  further down.
- **Bağ vitrini:** 4 listings. **Son elanlar:** 8 listings.
- **Header (home page only):** one row: logo · Məhsullar · Xidmətlər · Satıcılar · Bağ vitrini · ♡ · Daxil ol ·
  «Elan yerləşdir».
  - It hides while you scroll down and comes back when you scroll up.
  - Once the hero search is out of view, a short search field takes the place of the menu and leads back to it.
- **Motion:** the hero fades in, cards appear as you scroll, photos zoom slightly on hover and the heart "pops".
  None of it runs for visitors who ask their device for reduced motion.
- **Colours:** grey and olive text are a little darker, so all text meets the contrast minimum.
- **Accessibility:**
  - an «Əsas məzmuna keç» link on every page, shown when you press Tab;
  - clearer names for links and price fields;
  - the header menu can always be reached with the keyboard.
- **Not changed yet:** the listing card design (next step) and the header on the other pages.

## Commits

| Commit | What it does |
|---|---|
| `91a9a98` copy | «VIP» → «Bağ vitrini» / «Vitrin» everywhere; new hero heading and subtitle |
| `30420f1` docs(design) | Variant 2 mockups added to the repository |
| `8b5bf45` chore | lint skips Claude tool scripts; a file-name clash that broke the build on Windows is fixed |
| `795affe` feat(tokens) | Variant 2 colours, corner radii, shadows and animation timings; darker grey text |
| `9bcb5d9` feat(data) | the 10 Variant 2 categories, city counts, 4 vitrin and 8 latest sample listings |
| `73558ed` docs(handoff) | categories and pending filters for the backend ([categories.md](categories.md)) |
| `d363cc4` feat(data) | new shrub icon for «Kollar» |
| `0e4e2ae` fix(a11y) | darker olive for text on white, for contrast |
| `76f8b2b` docs(handoff) | follow-ups list ([follow-ups.md](follow-ups.md)) |
| `fe2abd9` feat(ui) | keyboard-friendly city dropdown and a shared popover panel |
| `aa4b2b6` fix(ui) | Tab picks the highlighted city, as the WAI-ARIA pattern prescribes |
| `bc4e054` feat(home) | hero search card: tabs, search word, city, «Axtar» and filter chips |
| `be98a71` feat(home) | phones: chip row, «Filtrlər» sheet, scrolling categories row |
| `fb498b6` feat(home) | categories grid, «Bağ vitrini» section and the one-row home header |
| `526bae7` fix(home) | short search placeholders that fit on phones |
| `36c059e` feat(motion) | header hides and returns on scroll; search field in the header once the hero search is gone |
| `9fcb82b` feat(motion) | hero entrance, card reveal, photo zoom and heart pop |
| `e1d8916` fix(motion) | keyboard focus is no longer lost when the header search replaces the menu |
| `1130b38` fix(a11y) | audit fixes: link and price-field names, header menu reachable by Tab, skip link, demo banner landmark |
| docs(handoff) | this summary, plus two accessibility items added to the follow-ups |

## Pending on the backend (Ruslan)

Proposed names, values and the current URL parameters are in [categories.md](categories.md).

1. **New filters.** «Kök sistemi», «Mövcudluq», «Əkin daxil» and «Çatdırılma» for services are shown but not sent.
   The proposed parameters are `kok`, `movcudluq`, `ekin` and `catdirilma` for services. Please confirm the names
   and one set of values for both the filters and the post-ad form. After that, the frontend starts sending them.
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

- **Listing card (next step):** match the Variant 2 card: price style, 4:3 photo, «Vitrin» badge icon and a compact
  phone card. Also bring small touch targets up to 44 px: the favourite button, section links, footer links and the
  bottom bar.
- **Old category names:** the `/xidmetler` title and the seller page tabs still use them.
- **Screen reader check:** a manual pass with NVDA or VoiceOver is still to do.
