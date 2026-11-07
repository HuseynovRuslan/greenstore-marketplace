# Pages roadmap — "everything else" pass (Nov 2026)

Built from [pages-inventory.md](../research/pages-inventory.md) (Phase 0) and
[turbo-functional-analysis.md](../research/turbo-functional-analysis.md) (Phase 1). Branch `nextjs-migration`, one
commit per step, lint + typecheck + test + build before each commit, never pushed. Contract additions are logged in
[contract-additions.md](../handoff/contract-additions.md).

**Quality bar on every page:** Variant 2 design language (tokens only, Inter, semibold forest headings, 12 px cards,
existing Listbox / Popover / Dialog-sheet / FilterControls / ListingCard), visible labels + helper text + inline
validation, correct `type` / `inputmode` / `autocomplete`, 16 px fields on touch, 44 px targets, Azerbaijani copy
(no "VIP"), 390 → 1440 without horizontal scroll, loading / empty / error states, axe 0, keyboard-complete, tests for
new logic, no CLS, server components by default. Motion: reuse press feedback, sheet and springs; no new
site-wide entrance/scroll animation.

## Order and contents

Order change while building: the **listing page (3) is built before the posting flow (1)**, so the posting preview
renders the real listing components instead of a look-alike.

### 0. Foundation
- Contract additions (types, repository, mock data: plant facts, care tips, wholesale, hours, promotion packages,
  OTP mock, stats) + handoff doc.
- **One header everywhere**: the Variant 2 header (logo · Məhsullar · Xidmətlər · Satıcılar · Önə çıxanlar · ♡ ·
  account · «Elan yerləşdir») on every public page; the posting flow keeps a focused header with «Çıx».
- Shared bits: page heading component, `PhoneField` (+994 mask), `PasswordField` (show/hide), `OtpField`,
  `ChoiceCard` (radio cards), `Toggle` switch, `Stepper`, `ShareButton`, `Toast`.

### 1. «Elan yerləşdir» — premium multi-step posting (`/elan-yerlesdir`, `/elan-yerlesdir/[addim]`, `/elan-yerlesdir/gonderildi`)
Six steps with a progress bar and a step list that shows done / current / to-do:
1. **Növ və kateqoriya** — product / service cards, category grid with icons, subcategory chips.
2. **Məlumatlar** — title (80) + description (3000, counter, phone-number warning), category attributes from one
   definition list shared with the catalogue (height, age, root system, pot size, sun, water, frost hardiness,
   foliage, availability, quantity…).
3. **Şəkillər** — drag & drop and file picker, 1–12 photos, JPG/PNG/WebP ≤ 10 MB with per-file errors, reorder by
   drag **and** buttons, «Örtük et», photo rules.
4. **Qiymət və ünvan** — fixed / negotiable / by agreement, unit, wholesale price + minimum quantity, city + area,
   delivery (areas) and planting toggles.
5. **Əlaqə** — name, phone (+994 mask, pre-filled), WhatsApp toggle, hide-number option.
6. **Yoxla və göndər** — preview rendered by the real listing components, optional promotion package, rules checkbox.
- Autosave (localStorage) with «Qaralama saxlanıldı» status, resume banner, «Yenidən başla».
- Step validation with errors next to fields + an error summary after a failed «Davam et»; Back keeps everything.
- Phones: sticky bottom bar (Geri / Davam et), 16 px fields, sheet pickers.
- Success page: listing card, what happens next (review ≤ 1 hour), share, «Elanlarım», «Yeni elan».

### 2. Auth (`/daxil-ol`, `/qeydiyyat`, `/sifreni-berpa-et`)
- Login: phone + password or **SMS code**; show/hide password; autofill-friendly; clean errors; demo note.
- Registration: individual vs business (nursery / garden centre / landscaping company cards) → details → **SMS code**
  → done. Password strength hints.
- Forgot password: phone → code → new password → signed in.

### 3. Listing page (`/elanlar/[slug]`)
Gallery (all photos, thumbnails, lightbox with swipe/keys/zoom, counter) · price block (unit, negotiable, wholesale,
stock) · phone reveal (counted) and WhatsApp · attributes table · care block · delivery/planting facts · seller card
(verified, member since, response time, other listings) · share, report, favourite · ID, views, published / updated
· similar listings · safety note · sticky contact bar on phones · owner strip («Bu sizin elanınızdır» → edit /
promote).

### 4. Seller / nursery page (`/saticilar/[slug]`) and directory (`/saticilar`)
Cover, logo/initials, verified, kind, member since, response time, about, offers (delivery, planting, design,
wholesale), weekly hours with «İndi açıqdır», address with map link, contact (reveal, WhatsApp, Instagram), share,
report; listings with category tabs, search and sort (shared Listbox). Directory: kind tabs and city filter.

### 5. Kabinet (`/kabinet`, `/kabinet/profil`)
Tabs by status with counts (Aktiv · Yoxlamada · Müddəti bitib · Rədd edilib · Deaktiv · Qaralamalar); per listing:
thumbnail, price, days left, stats (views, phone reveals, favourites) and actions (edit, renew, deactivate /
activate, delete with confirm, «Önə çıxar»); rejection reason with «Düzəlt»; drafts resume the wizard; per-listing
stats sheet with a 14-day chart. Profile settings: personal / business details, hours, notifications, password,
sign out.

### 6. Favourites and saved searches
«Axtarışı yadda saxla» on `/elanlar` (name + alert toggle, mock), list in `/secilmisler` (tab «Axtarışlar») and in
the cabinet; open, rename, alert on/off, delete.

### 7. Promotion packages (`/reklam`)
«İrəli çək», «Önə çıxar», the bundle: benefits, options and prices, «how it shows» illustration, FAQ; choose a
listing (from the cabinet or `?elan=`), mock checkout (card form), success.

### 8. Services (`/xidmetler`, `/xidmetler/[slug]`)
Catalogue on the shared header/search-card/sidebar look (category list with icons and counts, area, verified,
sort), Variant 2 service cards; service page aligned with the listing page + **«Usta çağır»** request form (sheet on
phones) with success state; «Usta çağır» also from the catalogue.

### 9. The rest
404 with search and categories; footer pages (Elan qaydaları, Təhlükəsiz alış, Kömək, Əlaqə with a form, İstifadə
şərtləri, Məxfilik siyasəti); the compact footer on inner pages becomes a row of real links (the full footer stays on
the home page); admin header and headings aligned (internal tool, light touch).

### 10. Wrap-up
Screenshots of every page and key state at 1440 / 390 in `docs/design/pages-v2/`; `docs/handoff/pages-v2.md`
(commits, what each page does, mock vs real, contract additions, open questions); summary with localhost URLs.

## Progress

Update after every commit (newest last).

| Step | Status | Commit |
|---|---|---|
| Phase 0 inventory, Phase 1 analysis, Phase 2 plan | done | 58fbb83 |
| 0 · Contract additions + mock data | done | e87f2ff |
| 0 · One header everywhere, shared form controls, toast, share | done | c7bf7e1 |
| 3 · Listing page (gallery + lightbox, price/wholesale/stock, contact, attributes, care, report) | done | 91db55d |
| 1 · Posting flow (6 steps, autosave, photos in IndexedDB, preview = listing page, promotion, success) | done | eb219a1 |
| 2 · Auth (login by password or SMS, registration with business kinds + SMS code, password reset) | done | bde3a68 |
| 4 · Seller / nursery page + /saticilar directory | done | d9ac549 |
| 5 + 6 · Kabinet (statuses, renew/edit/deactivate/delete/promote, stats) + favourites + saved searches | done | 17ba8ae |
| 7 · Promotion packages (/reklam) with mock checkout; owner strip on the listing page | done | b798bb0 |
| 8 · Services catalogue and service page + «Usta çağır» | done | f855d5f |
| 9 · 404, support pages (Kömək, Elan qaydaları, Təhlükəsiz alış, Əlaqə + form, şərtlər, məxfilik), footer links, admin headings | done | 8fb1803 |
| Fix · phone contact bar with worst-case prices (break-ui pass) | done | 2a10775 |
| 10 · Wrap-up: screenshots (docs/design/pages-v2), handoff (docs/handoff/pages-v2.md), viewer a11y fix | done | (this commit) |

All steps done. Next (not in this pass): messaging, price history, balance/payments, admin layouts, the site-wide
motion pass, real-device checks — see [pages-v2.md](../handoff/pages-v2.md) → open questions.
