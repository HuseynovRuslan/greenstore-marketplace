# turbo.az functions → GreenStore (Phase 1)

Goal from management: GreenStore should be for plants, trees, garden products and garden services what turbo.az is
for cars — **in function, not in look**. A turbo.az-looking version was rejected; nothing here copies its colours,
layout or wording, and the word "VIP" is never used (our names: «Önə çıxan», «Önə çıxar», «İrəli çək»).

**Source.** Researched on 7 Nov 2026: the posting form (`/autos/new`, filled but not submitted), rules and terms
pages (AZ + RU), three listing pages, the dealer directory and three dealer pages, favourites, both logins and the
App Store release notes. Logged-in screens («Elanlarım», balance) could not be opened; those rows lean on a
third-party guide (qebulol.az, 2025) and are marked *(3P)*. Prices quoted are turbo.az's, for context only.

**Priority:** **Must** = this pass; **Should** = this pass if time allows, else next; **Later** = needs a backend
decision or a real integration (SMS, payments, maps).

## 1. What turbo.az does, in one paragraph

Search-first catalogue with deep filters and numbered pages; a long one-page posting form whose dropdowns come from a
vehicle catalogue (sellers never type specs); every listing is moderated before it goes live and lives 30 days; one
free listing per 30 days, then paid; promotion is the business model (bump, VIP, Premium, sold per listing, even to
logged-out visitors); dealers have a directory and their own pages; the listing page is ID + views + updated date,
price, specs table, masked phone with «show number», complaint form with fixed reasons, an anti-fraud warning and
similar listings. No share buttons, no compare, no saved-search button on the web.

## 2. Function map

| # | turbo.az function | GreenStore version | Priority | Pages affected |
|---|---|---|---|---|
| **Posting** |||||
| 1 | One long form; car type tabs (Minik / Kommersiya / Moto) | Multi-step wizard (6 steps): **kind** (product / service) and **category** first, because they decide every later field | Must | /elan-yerlesdir |
| 2 | Cascading specs from a vehicle catalogue (marka → model → il → nəsil → mühərrik…) | **Category-specific attributes** from one definition list shared with the catalogue filters: trees/shrubs/roses/house plants/seedlings get species, height, age, root system, pot size, sun, water, frost hardiness, foliage; soil/fertiliser get pack size; tools get condition; irrigation gets type. Chosen from lists where possible, typed only when numeric | Must | /elan-yerlesdir, /elanlar (same params), listing page |
| 3 | Photos: min 3, max 21 (48 for dealers), ≥ 1024×768, guided first slots, drag reorder, no screenshots / frames / other sites' logos | Photos: **min 1, max 12**, JPG/PNG/WebP ≤ 10 MB, drag & drop **and** «Sola / Sağa» buttons (WCAG 2.5.7), «Örtük et», per-file errors, rules shown next to the drop zone («Öz bitkinizin şəkli; skrinşot və internetdən şəkil yox») | Must | /elan-yerlesdir |
| 4 | Condition checkboxes with helper text («Vuruğu var?», «Qəzalı…») | Plant condition is mostly attributes; add **«Mövcudluq»**: «Satışda» / «Sifarişlə» and stock quantity | Should | /elan-yerlesdir, listing page |
| 5 | Description 3000 chars with live counter; no phone numbers in it | Description ≤ 3000 with counter; title ≤ 80; warning when a phone number is typed into the text | Must | /elan-yerlesdir |
| 6 | Price + currency (AZN/USD/EUR); «Kredit», «Barter» flags; full price only | Price in ₼ only; **fixed / negotiable («razılaşma mümkündür») / by agreement**; **price unit** (ədəd, kq, litr, m², kisə, dəst, metr); **wholesale price + minimum quantity** («topdan»). No credit/barter: rare for plants | Must | /elan-yerlesdir, cards, listing page |
| 7 | City (≈80) + contact name, email, phone | City + optional area / village; **delivery** (areas) and **planting on site** («Əkin xidməti») toggles | Must | /elan-yerlesdir, listing page, filters (pending ones) |
| 8 | Phone confirmed by SMS before review (when not logged in) | Contact step: +994 mask, **WhatsApp** toggle, **hide number** (buyers write on WhatsApp only). Posting requires an account (phone verified at registration), so no second SMS | Must | /elan-yerlesdir |
| 9 | No preview; terms line under «Davam et» | **Preview exactly as the listing page**, rules checkbox, then submit | Must | /elan-yerlesdir |
| 10 | Paid services offered after posting | **Optional promotion package** on the last step (paid only after approval) | Must | /elan-yerlesdir |
| 11 | Email PIN to edit without an account | Not needed: account required | — | — |
| 12 | (Autosave: none observed) | **Autosave draft**, resume later, drafts tab in the cabinet | Must | /elan-yerlesdir, /kabinet |
| **Moderation and lifetime** |||||
| 13 | Every listing reviewed (minutes, ≤ 1 h); edits re-reviewed within an hour; rejection reason by email | Same: status «Yoxlamada» after submit; reason shown in the cabinet on «Rədd edilib» with «Düzəlt və yenidən göndər» | Must | /kabinet, success page |
| 14 | Statuses: Saytda / Gözləmədə / İmtina olunmuş / Müddəti başa çatmış *(3P)* | Tabs: **Aktiv · Yoxlamada · Müddəti bitib · Rədd edilib · Deaktiv · Qaralamalar** with counts | Must | /kabinet |
| 15 | Lifetime 30 days; paid restore (4–15 ₼) | 30 days; **free «Yenilə»** for expired listings (we need supply more than fees); «N gün qalıb» per listing | Must | /kabinet |
| 16 | 1 free listing / 30 days, then 8–30 ₼; repeat-listing fee | **Later**: business decision. UI note only | Later | — |
| 17 | Max 2 edits per day; contacts, make, model, year locked after publishing | Edit allowed; **category locked** after publishing (like make/model); edits go back to review | Should | /kabinet, /elan-yerlesdir |
| **Paid promotion** |||||
| 18 | «İrəli çək» 1×3 … 10×15 ₼ | **«İrəli çək»**: lifts the listing to the top of «Ən yenilər»; 1 time / 5 days / 10 days | Must | /reklam (packages), /kabinet, listing page (owner) |
| 19 | «VIP»: VIP block + random positions in search | **«Önə çıxar»**: «Önə çıxan» badge, top of search, home «Önə çıxan elanlar»; 3 / 7 / 15 days | Must | same |
| 20 | «Premium»: home page + VIP + bumps | **Bundle «Önə çıxar + İrəli çək»** | Must | same |
| 21 | Buy buttons on every public listing page, even logged out | Owner sees «Önə çıxar» on their listing page and in the cabinet; public pages stay calm (management: no turbo.az look) | Must | listing page (owner), /kabinet |
| 22 | Payment: card, terminals, balance top-up, bonuses | **Mock checkout** (card form, success); balance and history later | Must (mock) | /reklam |
| **Business accounts** |||||
| 23 | Dealer directory with filters and sort | **Seller directory** «Satıcılar»: nurseries, garden centres, landscaping companies; filter by kind and city | Should | /saticilar |
| 24 | Dealer page: cover, description, address → Google Maps, hours as text, masked phone, member since, views, listings with sort only | **Nursery page**: cover, logo/initials, verified, member since, response time, about, **weekly hours with «İndi açıqdır»**, address + «Xəritədə aç», services offered (delivery, planting, design, wholesale), contact; listings **with category tabs, search and sort** | Must | /saticilar/[slug] |
| 25 | Separate business login (email + password); monthly packages | One login; **registration asks individual vs business** and the business kind | Must | /qeydiyyat |
| 26 | «Salon» / «Rəsmi» badges on cards | «Təsdiqlənmiş satıcı» on the seller card and page | Must | listing page, seller page |
| **Listing page** |||||
| 27 | «№ 10769674», «Baxışların sayı», «Yeniləndi» | Same facts: **Elan №**, views, published and updated dates | Must | listing page |
| 28 | Gallery with thumbnails, «+11 şəkil» | Gallery: all photos, thumbnails, **lightbox with swipe / arrow keys / zoom**, counter | Must | listing page, service page |
| 29 | Specs table | **Attributes table** from `PlantFacts` (+ old specs) | Must | listing page |
| 30 | (none) | **Care block** «Qulluq»: sun, water, frost hardiness, planting months + the seller's tips | Must | listing page |
| 31 | Masked phone «+994 •••» + «Nömrəni göstər» | Same, counted (`revealPhone`); **WhatsApp** button; hidden numbers → WhatsApp only | Must | listing page, seller page |
| 32 | «Mesaj yaz» (in-app chat) | **Later** (needs messaging backend); WhatsApp covers it now | Later | — |
| 33 | «Seçilmişlərdə saxla» (works logged out) | Same (already works for guests) | Must | listing page, cards |
| 34 | «Şikayət et» with 10 fixed reasons | Report dialog with plant-world reasons («Satılıb / aktual deyil», «Yanlış qiymət», «Şəkillər bu bitki deyil», «Dələduzluq şübhəsi», «Təkrar elan», «Digər») + comment, success state | Must | listing, seller, service pages |
| 35 | «Diqqət! … beh göndərməyin» | «Bitkini görmədən beh göndərməyin» next to the contact | Must | listing page |
| 36 | «Bənzər elanlar», «Salonun digər elanları» | Same: similar + the seller's other listings | Must | listing page |
| 37 | No share | **Share** (Web Share API, copy link fallback) — plants are bought for/with family | Must | listing, seller, service pages |
| 38 | Price history (app only) | Later | Later | — |
| 39 | Sticky contact on phones (app) | **Sticky contact bar** on phones (price + call/WhatsApp) | Must | listing page |
| **Search** |||||
| 40 | Deep filters, live counts, numbered pages, sort | Done in Variant 2 (/elanlar) | Done | — |
| 41 | Saved searches + notifications (app only) | **«Axtarışı yadda saxla»** with a name and an **alert toggle** (mock); list and manage in the cabinet | Must | /elanlar, /kabinet, /secilmisler |
| 42 | «Artıq baxılıb» on seen cards | Later (needs a viewed-list store) | Later | cards |
| 43 | Compare | Not useful for plants | — | — |
| **Account** |||||
| 44 | SMS-code login, no password (users); email + password (business) | **Phone + password** login, plus **login by SMS code**; **forgot password** via SMS code; all mock (code shown in a demo note) | Must | /daxil-ol, /qeydiyyat, /sifreni-berpa-et |
| 45 | Daily stats chart per listing (app) | **Per-listing stats**: views, phone reveals, favourites, 14-day chart | Must | /kabinet |
| 46 | Balance, bonuses, payment history | Later (payments) | Later | /kabinet |
| **Services (no turbo.az equivalent; tap.az-like)** |||||
| 47 | — | /xidmetler on the shared filter model and card style; service page with **«Usta çağır»** request form (date, area size, description, contact) | Must | /xidmetler, /xidmetler/[slug] |
| **Support pages** |||||
| 48 | Rules, terms, buyer advice, support phone | **«Elan qaydaları»**, **«Təhlükəsiz alış»**, **«Kömək»** (FAQ), **«Əlaqə»**, «İstifadə şərtləri», «Məxfilik siyasəti» — footer links become real | Should | footer, new static pages |

## 3. Decisions that differ from turbo.az on purpose

- **Wizard, not one long form.** Plant listings depend on the category more than cars do (a sack of compost has no
  height); a step per concern keeps phones manageable and lets us validate early.
- **Fewer minimum photos (1 vs 3).** Many sellers are small growers posting from a phone; one good photo is enough to
  start. Up to 12 is plenty for plants.
- **Free renewal.** Supply is the bottleneck at launch; promotion, not renewal fees, is the revenue.
- **No buy buttons on public pages.** Promotion is sold to owners in their own views (management rejected the
  turbo.az look, and visitors shouldn't see sales pitches on someone else's listing).
- **Share and care tips added.** Neither exists on turbo.az; both matter for plants (gifts, "will it survive here?").
