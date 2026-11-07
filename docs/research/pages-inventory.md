# Pages inventory (Phase 0)

Snapshot of every route in `src/app` on 7 Nov 2026 (branch `nextjs-migration`, commit `8111ab8`), before the
"everything else" pass. Screenshots (local, not in git): [`.screenshots/pages-inventory/`](../../.screenshots/pages-inventory/) — `<name>-1440.jpg` and `<name>-390.jpg`, full page,
demo banner dismissed, reduced motion. "Signed in" means the demo session (Elvin Əliyev, Abşeron Tingçilik).

The home page and `/elanlar` (Variant 2) are the reference for the design language: the one-row home header,
semibold forest headings (18/22 px, tight tracking), cards with 12 px radius, chips, Listbox / Popover / sheet,
press feedback and springs. Every other page still uses the first Figma file: a header with a search bar,
a compact footer, 23–30 px regular-weight headings, tab "pills" that look like buttons, native `<select>`s.

## Site-wide

| Area | Today | Weak |
|---|---|---|
| Header | Home + catalogue: Variant 2 header. All other pages: old header (logo · search bar · ♡ · Daxil ol · Elan yerləşdir); phones: logo · search icon · menu. | Two headers on one site; the nav disappears on inner pages, so «Xidmətlər» / «Satıcılar» are one hop further. |
| Footer | Home: full footer. Inner pages: two text lines. | Support links («Elan qaydaları», «Təhlükəsiz alış», «Bizimlə əlaqə», «İstifadə şərtləri», «Məxfilik siyasəti») are plain text: the pages don't exist. |
| Bottom nav (< 768 px) | Ana səhifə · Axtarış · Elan yerləşdir · Seçilmişlər · Profil | Items 40 px tall (target 44). |
| Session | Demo only, localStorage; any well-formed credentials sign in the demo seller. | No phone OTP, no registration result, no individual account. |
| Seller directory | «Satıcılar» links to `/#saticilar` (three cards on the home page). | No list of nurseries / garden centres to browse. |

## Routes

### `/` — home (Variant 2) · [1440](../../.screenshots/pages-inventory/home-1440.jpg) · [390](../../.screenshots/pages-inventory/home-390.jpg)
Hero search (tabs, query, city, filter chips, categories row), «Önə çıxan elanlar», «Son elanlar», services,
sellers, trust tips, full footer. **Done**; out of scope except the shared header/footer.

### `/elanlar`, `/kateqoriyalar/[kateqoriya]`, `/kateqoriyalar/[kateqoriya]/[seher]` — catalogue · [1440](../../.screenshots/pages-inventory/elanlar-1440.jpg) · [390](../../.screenshots/pages-inventory/elanlar-390.jpg) · [category](../../.screenshots/pages-inventory/kateqoriya-1440.jpg)
Variant 2: search card, sticky sidebar with category list and filters, sort, grid/list, chips, pagination, empty
state, skeleton, phone filter sheet. **Done.** Missing functions: **«Axtarışı yadda saxla»** (saved search + alert),
the pending filters (root system, availability, planting included) are flagged off until the API has them.

### `/elanlar/[slug]` — listing detail · [1440](../../.screenshots/pages-inventory/listing-1440.jpg) · [390](../../.screenshots/pages-inventory/listing-390.jpg) · [404](../../.screenshots/pages-inventory/listing-404-1440.jpg)
Breadcrumb, badges, title, «Abşeron · 12 oktyabr 2026 · Elan № 10482 · 248 baxış», gallery (main + 3 thumbs),
price panel (favourite, share), seller panel (phone reveal, WhatsApp, hours, all listings), specs, description,
«Alışdan əvvəl dəqiqləşdirin», report, other seller listings, similar listings. Phones: sticky phone/WhatsApp bar.
- **UI:** first-Figma typography (regular 30 px title, 23 px panel titles); gallery shows only 4 of up to 10 photos
  and has no lightbox, no swipe, no counter; thumbnails are not buttons for the main image.
- **Missing:** care tips (sun, water, frost, planting season), «Yeniləndi» date, wholesale price / minimum
  quantity, «Əkin daxil» / delivery terms as facts, phone-reveal count, listing ID copy, seller "member since" in
  the card on phones, report flow states (it exists as a dialog), "safe deal" tips near the contact.
- **390:** the sticky contact bar overlaps the bottom nav region; the seller panel repeats the same two buttons
  that the sticky bar already has; specs grid is two narrow columns.
- **Copy:** «Seçilmişlər» on a button that adds to favourites (state not obvious), «3 fotoşəkil · Örtük şəkli».

### `/saticilar/[slug]` — seller page · [1440](../../.screenshots/pages-inventory/seller-1440.jpg) · [390](../../.screenshots/pages-inventory/seller-390.jpg)
Cover photo, name, kind, badges, about, terms, contact panel (person, address, phone reveal, WhatsApp, report),
tabs by category, in-seller search, sort, cards, pagination, «Təsdiqlənmiş satıcı nə deməkdir?».
- **UI:** old header; no logo/avatar; tabs are grey pills; sort is a native select ([follow-ups](../handoff/follow-ups.md)).
- **Missing:** working hours as a weekly table with "open now", address with a map link, services the business
  offers, delivery/planting terms as facts, member since, response time, rating placeholder, share.
- **Copy:** tab names use old category names («Tinglər», «Torpaq və gübrələr»).

### `/xidmetler` — services catalogue · [1440](../../.screenshots/pages-inventory/xidmetler-1440.jpg) · [390](../../.screenshots/pages-inventory/xidmetler-390.jpg)
Variant 2 header, but the body is the first Figma: heading, search field + area select, six grey category
tiles without icons, three pills (all / companies / individuals), sort, cards with a «Xidmətə bax» button, pagination.
- **UI:** doesn't share the catalogue's search card, sidebar, chips or card style; the category tiles look disabled.
- **Missing:** filters (price from, area, verified), «Usta çağır» request, empty state copy check.

### `/xidmetler/[slug]` — service detail · [1440](../../.screenshots/pages-inventory/service-1440.jpg) · [390](../../.screenshots/pages-inventory/service-390.jpg)
Gallery, price panel, provider panel (phone, WhatsApp, hours), about + checklist, areas + process, portfolio,
report. **Missing:** «Usta çağır» request form, share, ID/views, similar services, provider's other services.

### `/secilmisler` — favourites · [1440](../../.screenshots/pages-inventory/secilmisler-1440.jpg) · [390](../../.screenshots/pages-inventory/secilmisler-390.jpg)
Tabs (all / products / services), cards, empty state. **Missing:** saved searches, sort, "price changed" or
"no longer available" states, guest note ("sign in to keep them on every device").

### `/daxil-ol` — login · [1440](../../.screenshots/pages-inventory/daxil-ol-1440.jpg) · [390](../../.screenshots/pages-inventory/daxil-ol-390.jpg)
Phone / e-mail switch, password, «Məni xatırla», «Şifrəni unutmusunuz?» (inline notice), link to registration.
- **UI:** first-Figma card; the form is pre-filled with the demo credentials; no show/hide password.
- **Missing:** login by SMS code, real forgot-password flow (phone → code → new password), `autocomplete` audit,
  +994 mask.

### `/qeydiyyat` — registration · [1440](../../.screenshots/pages-inventory/qeydiyyat-1440.jpg) · [390](../../.screenshots/pages-inventory/qeydiyyat-390.jpg)
Individual / business switch, business type select, company, contact person, phone/e-mail, password ×2, terms.
- **Missing:** phone OTP step, success state, show/hide password, password strength, the three business kinds as
  cards (nursery / garden centre / landscaping company), +994 mask. Pre-filled with demo data.

### `/elan-yerlesdir`, `/elan-yerlesdir/[step]`, `/elan-yerlesdir/gonderildi` — posting · [step 1, signed in](../../.screenshots/pages-inventory/elan-yerlesdir-1440.jpg) · [390](../../.screenshots/pages-inventory/elan-yerlesdir-390.jpg) · [guest](../../.screenshots/pages-inventory/elan-yerlesdir-guest-1440.jpg) · [sent](../../.screenshots/pages-inventory/gonderildi-1440.jpg)
Six numbered steps (kind, category + attributes, photos + text, price + location, contact, preview), summary
sidebar, autosave, the Figma example draft («Leyland sərvi — 120 sm») pre-filled.
- **UI:** first-Figma workflow header and radio cards; a numbered stepper that doesn't show which steps are done;
  native selects; the summary sidebar repeats data.
- **Missing:** category-specific attributes from the catalogue's filter model (height, age, root system, pot size,
  sun / water, frost hardiness), wholesale price with minimum quantity, «Razılaşma yolu ilə», price unit choice
  per category, drag-and-drop **reorder**, photo count up to 12, size/format errors per file, +994 phone mask,
  hide-number option, a preview that is the real listing page, promotion package, success page with share.
- **Copy:** pre-filled demo draft hides the empty state; step titles are long («Məhsul və ya xidmət seçimi»).

### `/kabinet` — dashboard / «Elanlarım» · [1440](../../.screenshots/pages-inventory/kabinet-1440.jpg) · [390](../../.screenshots/pages-inventory/kabinet-390.jpg) · [guest](../../.screenshots/pages-inventory/kabinet-guest-1440.jpg)
Greeting, account tabs, four stat tiles, pending notice, my listings with status tabs (all / active / under review /
expired), row actions (edit, deactivate, renew, view), «Daha çox», 7-day views chart.
- **Missing:** «Rədd edilib» and «Qaralamalar» tabs, rejection reason, «Önə çıxar» / «İrəli çək» per listing,
  delete with confirm, per-listing stats (views, phone reveals, favourites), expiry date and days left,
  balance / payment history, saved searches.
- **UI:** stat tiles are big empty boxes; actions are grey/white buttons without icons; chart has no axis or values.

### `/kabinet/profil` — profile · [1440](../../.screenshots/pages-inventory/kabinet-profil-1440.jpg) · [390](../../.screenshots/pages-inventory/kabinet-profil-390.jpg)
Profile form (name, company, business type, city, address, about), security form, notification switches.
**Missing:** working hours, logo/cover upload for business profiles, phone change with OTP, delete account.

### `/kabinet/elanlar/[slug]` — owner preview · [1440](../../.screenshots/pages-inventory/kabinet-preview-1440.jpg) · [390](../../.screenshots/pages-inventory/kabinet-preview-390.jpg)
The owner's view of a pending/expired listing. Works; inherits the listing page's weaknesses.

### `/idareetme`, `/idareetme/kateqoriyalar`, `/idareetme/sikayetler` — admin (moderator) · [1440](../../.screenshots/pages-inventory/admin-1440.jpg) · [390](../../.screenshots/pages-inventory/admin-390.jpg) · [categories](../../.screenshots/pages-inventory/admin-kateqoriyalar-1440.jpg) · [complaints](../../.screenshots/pages-inventory/admin-sikayetler-1440.jpg)
Moderation queue with approve / reject + reason, categories table, complaints. Functional, first-Figma look.
Not linked from the public site; no access control (demo). Lower priority: internal tool.

### `/dev/worst-case` — break-ui fixture (dev only, 404 in production). Keep as is.

### Not found (`app/not-found.tsx`) · [1440](../../.screenshots/pages-inventory/not-found-1440.jpg) · [390](../../.screenshots/pages-inventory/not-found-390.jpg)
A small card «Səhifə tapılmadı» with one button. **Weak:** no search, no way to the catalogue or categories.

## Accessibility notes (from code and a keyboard pass)

- Old pages use `<select>` (fine for a11y, inconsistent with the Listbox elsewhere).
- Tab "pills" on the dashboard, favourites and seller page are links/buttons without `aria-current` / `aria-selected`
  in some places; the dashboard row actions are icon-less text buttons (fine) but "Bax" has no context.
- Forms: labels are visible everywhere (good); `autocomplete` and `inputmode` are missing on several fields
  (phone, OTP, address); errors are announced with `role="alert"` (good).
- Targets under 44 px: footer links, section links, bottom nav (known, follow-ups).

## Priorities that follow

1. Posting flow (the supply side; today it is a pre-filled Figma demo).
2. Listing detail (where buyers decide): gallery, facts, care tips, contact, trust.
3. Seller / nursery pages and the business registration path.
4. Cabinet: statuses, renew/promote, per-listing stats; favourites + saved searches.
5. Promotion packages (the revenue side), services catalogue alignment, footer pages, 404.
