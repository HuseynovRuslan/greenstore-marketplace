# Pages v2 — handoff (Nov 2026)

The "everything else" pass after the home page and `/elanlar`: GreenStore as the plant world's turbo.az in
**function**, in the Variant 2 look. Branch `nextjs-migration`, not pushed. Background:
[pages inventory](../research/pages-inventory.md) · [turbo.az functional analysis](../research/turbo-functional-analysis.md) ·
[roadmap with progress](../plan/pages-roadmap.md) · [contract additions for Ruslan](contract-additions.md).

Screenshots of every page and key state at 1440 and 390: [`docs/design/pages-v2/`](../design/pages-v2/)
(`<nn>-<page>-<width>.jpg`; `10-posting-*` and `15-auth-*` are full walk-throughs).

## Commits

| Commit | What |
|---|---|
| `58fbb83` | Docs: inventory (every route at 1440/390), turbo.az function map, roadmap |
| `e87f2ff` | Contract additions (types, repository, mock data, OTP mock, owner stats) |
| `c7bf7e1` | One header on every page; Phone/Password/SMS-code/Switch/Choice controls; toast; share |
| `91db55d` | Listing page |
| `eb219a1` | «Elan yerləşdir» posting flow |
| `bde3a68` | Auth: login, registration, SMS code, password reset |
| `d9ac549` | Seller / nursery pages and the `/saticilar` directory |
| `17ba8ae` | Kabinet («Elanlarım»), favourites, saved searches |
| `b798bb0` | Promotion packages `/reklam` with mock checkout |
| `f855d5f` | Services catalogue, service page, «Usta çağır» |
| `8fb1803` | Help / rules / safe buying / contact / terms / privacy; footer links; 404 |
| `2a10775` | Fix: phone contact bar with worst-case prices |

Checks before every commit: `npm run lint`, `npm run typecheck`, `npm test` (37 files, 249 tests at the end),
`npm run build`. axe-core (WCAG 2.2 AA tags) on every page and state in the screenshot set at 1440 and 390: 0
violations (one found in the photo viewer was fixed before this doc).

## What each page does now

| URL | What it does |
|---|---|
| `/elan-yerlesdir` → `/1…6` → `/gonderildi` | Six steps (category · details · photos · price and place · contact · review). Category-specific attributes from one list shared with the catalogue filters (height, age, root system, pot, light, water, frost hardiness, planting months, availability; pack size for soil; condition for tools; areas for services). Photos: drop or pick, 1–12, JPG/PNG/WebP ≤ 10 MB, ≥ 600 px, per-file messages (HEIC advice), scaled to 2000 px and kept in IndexedDB, reorder by drag or Sola/Sağa, «Örtük et». Price: fixed / negotiable / by agreement, unit, wholesale + minimum, stock. Contact: +994 mask, WhatsApp, «Zəng qəbul etmirəm». Review = the real listing page in preview mode + optional promotion + rules. Autosave with time, «Yenidən başla», progress with step links, error summary that takes focus, guests sign in at the end without losing the draft. Success: card, review timeline, promotion note, share, Elanlarım. Editing a published listing reuses the flow with the category locked. |
| `/daxil-ol` | Password (phone or e-mail in one autofill-friendly field, show/hide, «Şifrəni unutmusunuz?») or SMS code. |
| `/qeydiyyat` | Individual vs business (nursery / garden centre / landscaping company + name) → details with live password rules → SMS code → signed in. |
| `/sifreni-berpa-et` | Phone → code → new password → signed in. |
| `/elanlar/[slug]` | Gallery (swipe, arrows, thumbnails, full-screen viewer with keys and zoom), sticky summary (price with unit, «razılaşmaq olar», wholesale, stock, delivery, planting, counted phone reveal, WhatsApp with a first line, favourite, share), seller card (verified, member since, reply time), «beh göndərməyin» note, attributes, «Qulluq» (light, water, frost, planting months, the seller's tips), description, ID / dates / views, report dialog, the seller's other listings, similar ones, a phone contact bar, «Bu sizin elanınızdır» for the owner. |
| `/saticilar` | Directory: tabs by business kind with counts, city chips, cards, empty state, «Biznes hesabı aç». |
| `/saticilar/[slug]` | Business page: cover, logo/initials, verified, kind, member since, reply time, about, offers, services it publishes, listings with category chips / search / sort, contact (call, WhatsApp, Instagram, website), weekly hours with «İndi açıqdır», address with «Xəritədə aç», share, report. |
| `/kabinet` | Totals (14 days), notices (rejected, expiring), status tabs with counts in the URL, a card per listing with its numbers and actions: Önə çıxar, Redaktə et, Statistika (14-day chart + table), Deaktiv/Aktiv et, Yenilə (free, 30 days), Sil (confirm), rejection reason + «Düzəlt və göndər», the unsent draft. Loading, error with retry, empty state per tab. |
| `/kabinet/axtarislar` | Saved searches: filters, new matches, alert switch, open, rename, delete. |
| `/secilmisler` | Saved listings and services, saved-search strip, sold-out items greyed with «Seçilmişlərdən sil», guest note. |
| `/kabinet/profil` | Profile in the cabinet shell; notifications as switches. |
| `/reklam` | «İrəli çək», «Önə çıxar», bundle with durations and prices, where it shows, FAQ, listing picker (`?elan=`), card checkout. |
| `/xidmetler` | Search card, kinds with icons and counts, provider type and price presets (links), cards, sort, empty state, «Usta çağır» band. |
| `/xidmetler/[slug]` | Listing-page layout for services: gallery, summary with «Usta çağır», number, WhatsApp, provider card, included work, areas and process steps, projects, report, other / similar services, phone bar. |
| `/komek`, `/qaydalar`, `/tehlukesiz-alis`, `/elaqe`, `/istifade-sertleri`, `/mexfilik` | Support pages; `/elaqe` has a support form. |
| 404 | What happened, a search into the catalogue, categories, main sections. |
| Header / footer | The Variant 2 header on every page («Satıcılar» → `/saticilar`); the posting flow has a focused header with «Çıx»; footer links are real. |

## Mock vs real

Nothing is charged, texted or e-mailed. **Mock** (works end to end in the browser, marked «Demo» on screen where it
matters):

- **SMS code** — always `1234`, shown in a demo note; 5 attempts, 5-minute expiry, 60 s resend (src/services/mockWrites.ts).
- **Sign-in / registration / password reset** — no server checks passwords; the session lives in localStorage. A new
  registration is a new account without a seller page (empty cabinet).
- **Posting** — the Server Action re-validates and returns the next number; the listing is kept in this browser with
  small data-URL photos. Draft photos live in IndexedDB. Nothing is uploaded.
- **Cabinet actions** — renew, deactivate, delete, promote and edits are stored as local changes over the API data.
- **Promotion checkout** — the card form is checked in the browser (test card 4111 1111 1111 1111); the Server Action
  prices the option and answers «paid»; no card data leaves the browser.
- **Reports, «Usta çağır», support form** — validated and numbered by the mock; nobody receives them.
- **Saved searches and alerts** — stored per account in localStorage; no alerts are sent.
- **Owner statistics** — deterministic numbers from each listing's views.

**Real** (would work against the API as is): every read through `MarketplaceRepository`, the URL-driven catalogue,
server-rendered public pages, metadata and sitemap (now with `/saticilar`, `/reklam` and the support pages).

## Contract additions (for Ruslan)

All additive; full list with example payloads in [contract-additions.md](contract-additions.md). In short:

- `Listing`: dates (`updatedAt`, `expiresAt`, `bumpedAt`), `priceType`, `priceUnit`, `wholesale`, `quantityAvailable`,
  `area`, `plant` (PlantFacts), `careTips`, `plantingAvailable`, `deliveryAreas`, contact fields (`contactName`,
  `contactPhone`, `whatsapp`, `phoneHidden`), `promotion`, `rejectionReason`, `stats`. `ListingStatus` gains `'draft'`.
- `Seller`: `businessKind`, `logo`, `hours`, `whatsapp`, `instagram`, `website`, `location`, `offers`, `responseMinutes`,
  `serviceIds`.
- New types for promotion, posting input, OTP, registration, reports, service requests, saved searches, support.
- Repository: `listProviderServices`, `listOwnListings`, `getListingStats`, `listPromotionPackages`, `submitListing`,
  `revealPhone`, `createPromotionOrder`, `submitReport`, `submitServiceRequest`, `submitSupportMessage`,
  `requestOtp`, `verifyOtp`, `register`, `resetPassword`.

## Other changes worth knowing

- `--color-warning` darkened from `#96691e` to `#8a5f17`: 12 px warning text on `warning-soft` was 4.34:1.
- Field placeholders are muted now (they were ink, so they read as values); hints and errors are tied to their
  controls with `aria-describedby`.
- Filter pill classes moved to `src/features/search/filterStyles.ts` (server components can use them).
- Sample data added: plant facts for the Figma listings (`src/data/listingExtras.ts`), two own listings (rejected,
  inactive), business fields for the three sellers and a landscaping company page.

## Open questions

1. **Price 0** (carried over): is it «Razılaşma ilə»? The UI treats `price: 0` or `priceType: 'agreement'` that way.
2. **Free listing limits**: turbo.az gives one free listing per 30 days. We kept posting and renewal free; does
   management want a limit for private sellers?
3. **Posting without an account**: turbo.az allows it (PIN by e-mail). We ask guests to sign in at the last step.
4. **Category lock on edit**: kept like turbo.az (make/model locked). OK for plants?
5. **Moderation time**: the copy promises «adətən 1 saat». Is that realistic for the moderation team?
6. **Promotion prices**: sample prices (İrəli çək from 1 ₼, Önə çıxar from 5 ₼, bundle from 13 ₼). Need the real ones.
7. **Legal pages**: terms and privacy are sample text; they need a lawyer.
8. **Support contacts**: the phone (012) 555 40 40 and destek@greenstore.az are placeholders.
9. **Photo upload API**: the flow needs `POST /api/photos` → ids; min size 600 px and max 12 photos are our choice.
10. **Real-phone checks** still pending from the previous pass, plus now: camera picker on iOS/Android, drag-reorder
    on desktop Safari, date input in «Usta çağır» on iOS, the SMS code autofill (`autocomplete="one-time-code"`).

## Not done in this pass

- In-app messaging («Mesaj yaz»), price history, «Artıq baxılıb» on seen cards, balance and payment history.
- A site-wide entrance/scroll animation pass (a separate task, as agreed).
- Admin pages got the new headings only; their layouts are still first-Figma.
- No video recordings were made; the screenshot set covers each state.
