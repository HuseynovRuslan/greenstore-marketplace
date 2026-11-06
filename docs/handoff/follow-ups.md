# Follow-ups

A running list of known gaps from the Variant 2 home work that were left out of a step on purpose.
Kept up to date as steps land; remove an item when it is done.

## Copy that still uses the old category names

- **`/xidmetler` title and breadcrumb** say «Landşaft və bağçılıq xidmətləri», while the category is now «Bağ xidmətləri».
  Sources: `src/app/(main)/xidmetler/page.tsx` (metadata title), `src/views/ServicesPage.tsx` (`servicesCrumbs`, heading).
- **Seller page tabs** (Figma, Abşeron Tingçilik) say «Tinglər» and «Torpaq və gübrələr». The categories are now «Fidan və toxum»
  and «Gübrə və torpaq». Source: `src/features/seller/sellerStats.ts`.

## Design

- **ListingCard vs the Variant 2 mockup** (to be done as its own step):
  - Price: the mockup has 21 px bold forest; today it is 23 px regular ink.
  - Photo: the mockup uses a 4:3 ratio; today the height is fixed (145 / 210 px).
  - «Önə çıxan» badge: add the rocket icon used next to the section heading and in the header (the mockup had a
    leaf); today it is text only. Below 360 px the badge shrinks (11 px text, less padding) so it clears the
    favourite button; the restyle should give it proper room.
  - Date: the mockup shows the city only; today it shows «city · date».
  - Favourite button: 34 px today; the mockup keeps a 32 px circle inside a 44 px touch target.
  - Phones: the mockup card is compact (square photo, 17 px price, one-line title, city only).

## Accessibility

- **Targets under 44 px** (audit of 5 Nov, item 6; to be done with the ListingCard step). All of them meet the WCAG 2.5.8
  minimum of 24 px, but not the 44 px the project aims for:
  - favourite button 34 px;
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
- Category and city counts from the API instead of `src/data` (contract change).
