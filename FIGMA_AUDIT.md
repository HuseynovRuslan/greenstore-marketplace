# GreenStore — Figma audit

Source: <https://www.figma.com/design/uYNd146nDVjM8uLJoeY6NT/Untitled> (file key `uYNd146nDVjM8uLJoeY6NT`), read through the
official Figma MCP server on 2026‑10‑12 with the account `BAXMMC` (Professional plan, Full seat). The file was only read.

The prototype is branded **YARPAQ**. Every occurrence of the wordmark and of "YARPAQ" in copy ("2021‑dən YARPAQ‑da",
"YARPAQ alıcı və satıcını birləşdirir", "© 2026 YARPAQ", …) is rendered as **GreenStore** in the implementation. Nothing
else in the copy was changed.

Downscaled reference renders of every frame are committed in [`docs/figma/reference/`](docs/figma/reference) (50 % width,
JPEG) so future work can be compared without Figma access.

---

## 1. Access and method

| Step | Result |
| --- | --- |
| `whoami` | OK: `BAXMMC`, Professional plan, Full seat |
| File structure (`get_metadata`) | 1 page ("Page 1"), 25 top-level frames, 1,607 frames, 1,281 text nodes, 124 rectangles (107 with image fills) |
| Design context (`get_design_context`) | Used for the home page (1440/768/390), every section of the components frame, and the header, footer and workflow-header variants. The page agents used it for sections of their screens |
| Text and structure | A read-only Plugin API script dumped every frame as an outline (node, size, fill, stroke, radius, exact text, icon names) |
| Screenshots (`get_screenshot`) | All 25 frames rendered at 1x |
| Images | 95 unique image fills (107 placements). See §4 for how they were extracted |

**Network limitation.** The session's egress policy blocks `www.figma.com` (HTTP 403 on CONNECT). That host serves every
asset URL from `get_design_context` and `download_assets`, both the original image files and the SVG exports. So:

* Raster images were exported by rendering each image node through `get_screenshot`, which returns the PNG inline. That
  gives the exact crop shown in the design, but only at **1x node size**: the renderer never upscales and
  `download_assets` (2x–4x, original files) was unreachable. See §6.
* SVG icons were not downloaded. Every icon layer is named after its **Lucide** glyph (`heart`, `search`, `leaf`,
  `trees`, `amphora`, …), and the stroke colours and weights were read from the vectors, so the build uses
  `lucide-react` with identical glyphs, sizes and stroke widths.

---

## 2. Screen inventory

| # | Figma frame (node) | Size | Route | Contents |
| --- | --- | --- | --- | --- |
| 1 | Ana səhifə · 1440 (`4:34013`) | 1440×3900 | `/` | Header with section row; hero search (Məhsullar/Xidmətlər, query, city, category, price range, "Elanları tap", popular links); "Botanika vitrini" photo with stats 2 480+ / 340+; 10 categories; 3 VIP; 7 latest ads; 3 services; 3 sellers; safety band; 3‑column footer |
| 2 | Ana səhifə · 768 (`4:34270`) | 768×4623 | `/` | Tablet: 28 px gutter, no hero photo, 3‑column grids, no "Daxil ol" in header |
| 3 | Ana səhifə · 390 (`4:34517`) | 390×7424 | `/` | Mobile: compact header (logo, search, menu); stacked form; 2‑column categories and ads; 1‑column services and sellers; full‑width "Bütün … bax" buttons; stacked footer; 5‑item bottom navigation |
| 4 | Vizual komponentlər və vəziyyətlər (`4:34778`) | 1440×3123 | — | Design system sheet: palette, type scale, button states, field states (normal, focus, error, disabled), open select, price filter, chips, card states (normal, hover, favourited), category, seller and status badges, section tabs, mobile nav, phone hidden and revealed, deactivate and complaint dialogs, notices, empty states, loading skeleton |
| 5 | Mobil filtr paneli · 390 (`4:35031`) | 390×1402 | `/elanlar` (<768) | Bottom‑sheet filters over a dimmed "Ağaclar · 6 axtarış nəticəsi" bar: category, subcategory, city, min/max price, tree type, height, age, availability, delivery, seller type, "6 elanı göstər", "Filtrləri təmizlə" |
| 6 | Seçilmişlər · 390 (`4:35119`) | 390×1883 | `/secilmisler` | Account tabs; Hamısı/Məhsullar/Xidmətlər chips; 4 saved ads; one saved service; hint |
| 7 | Məhsul axtarışı · 1440 (`4:35211`) | 1440×1582 | `/elanlar` | Breadcrumb; "Bağınız üçün ağaclar"; filter sidebar; active chips; Şəbəkə/Siyahı toggle; "Ən yenilər" sort; 6 results; notice |
| 8 | Zeytun ağacı · 1440 (`4:35352`) | 1440×2595 | `/elanlar/:slug` | Gallery (main and 3 thumbnails); price panel; seller and contact panel (phone reveal, WhatsApp); specifications; description; safety notice; report; 3 other ads by the seller; 4 similar ads |
| 9 | Xidmətlər · 1440 (`4:35488`) | 1440×1960 | `/xidmetler` | Hero and search; 6 service categories; filter tabs; 6 service cards; pagination; pricing notice |
| 10 | Landşaft dizaynı · 1440 (`4:35615`) | 1440×2331 | `/xidmetler/:slug` | Gallery; price panel; company contact panel; "Xidmət haqqında" checklist; areas and process; 2 portfolio projects; report |
| 11 | Daxil ol · 1440 (`4:35707`) | 1440×1024 | `/daxil-ol` | Photo; "Yenidən xoş gəldiniz"; phone and email tabs; password; remember me; error alert |
| 12 | Qeydiyyat · 1440 (`4:35754`) | 1440×1350 | `/qeydiyyat` | Fərdi/Biznes; business type; company and contact name; phone and email; password with mismatch error; consent |
| 13 | Şəxsi kabinet · 1440 (`4:35828`) | 1440×1861 | `/kabinet` | "Salam, Elvin!"; 4 stats; pending notice; "Elanlarım" with status tabs and 4 rows; 7‑day chart; business promo |
| 14 | Profil məlumatları · 1440 (`4:35985`) | 1440×1825 | `/kabinet/profil` | Company and contact form; security panel; public profile card; notification preferences; verified notice |
| 15 | Abşeron Tingçilik · 1440 (`4:36085`) | 1440×2150 | `/saticilar/:slug` | Cover banner; badges; about; contact panel; category tabs; in‑seller search; sort; 6 ads; pagination; "Təsdiqlənmiş satıcı" explainer |
| 16–21 | Elan yerləşdir · 1…6 (`4:36195`, `4:36265`, `4:36369`, `4:36457`, `4:36547`, `4:36628`) | 1440×1024–1516 | `/elan-yerlesdir/:step` | Six‑step wizard with stepper, help notice and summary sidebar: (1) product or service, (2) category and attributes (with height‑range error), (3) photos and description, (4) price and location, (5) contact details, (6) preview and submit |
| 22 | Elan yoxlamaya göndərildi (`4:36700`) | 1440×1024 | `/elan-yerlesdir/gonderildi` | Success state; submitted card ("Yoxlamada"); next steps; CTAs |
| 23 | İdarəetmə · Moderasiya (`4:36731`) | 1440×1763 | `/idareetme/moderasiya` | Admin tabs; status chips; queue of 3; review panel; approve and reject; rejection reason with error state |
| 24 | İdarəetmə · Kateqoriyalar (`4:36824`) | 1440×1493 | `/idareetme/kateqoriyalar` | Category list (10); search; add; edit panel (name, subcategories, order, icon, filters) |
| 25 | İdarəetmə · Şikayətlər (`4:36969`) | 1440×1277 | `/idareetme/sikayetler` | Complaint list; detail with reported ad (Limon ağacı); decision buttons; history |

Only the **home page** has tablet and mobile frames. Mobile also has the filter sheet and favourites. Every other screen
exists only at 1440. Their tablet and mobile layouts were adapted from the same components, as the brief allows.

Navigation implied by the design: header (logo → home, search → catalogue, heart → favourites, "Daxil ol", "Elan
yerləşdir"); section row (Kateqoriyalar, Məhsullar, Xidmətlər, Satıcılar, VIP elanlar); card → detail; detail → seller
page; account tabs (Elanlarım, Seçilmişlər, Profil məlumatları, Elan statistikası); wizard steps 1→6 → confirmation →
"Elanlarıma keç"; admin tabs.

---

## 3. Design tokens

All values were read from the components frame and confirmed on the page frames. They are defined in
`src/styles/index.css` (`@theme`).

**Colour**

| Token | Hex | Figma name or usage |
| --- | --- | --- |
| `forest` | `#173F32` | "Meşə yaşılı": brand, primary buttons, icons, footer background |
| `forest-hover` | `#285541` | Primary button hover |
| `olive` | `#788149` | "Zeytun": focus ring (3 px on buttons, 2 px on fields), card hover border, VIP text, "VIP elanlar" link |
| `cream` | `#FAFAF6` | "İsti ağ": page background, header search field |
| `surface` | `#FFFFFF` | "Səth": cards and panels |
| `line` | `#DEE3D9` | "Sərhəd": every 1 px border |
| `ink` | `#20352B` | "Mətn": body text |
| `muted` | `#727C72` | Secondary text and placeholders |
| `mint` | `#EAF0E9` | Hero band, inactive tabs, tertiary buttons, filter chips, "Müddəti bitib" |
| `sand` | `#F0EEE4` | "Daha rahat və təhlükəsiz seçim" band |
| `disabled` | `#E8EBE5` | Disabled buttons and fields, skeletons |
| `vip` | `#F1F2E6` | VIP badge background |
| `success` / `success-soft` | `#287247` / `#EAF5EC` | "Aktiv", "Təsdiqlənmiş …", success notice |
| `warning` / `warning-soft` | `#96691E` / `#FBF2DC` | "Yoxlamada", review notice |
| `danger` / `danger-soft` | `#B6443F` / `#FAECE9` | Errors, "Rədd et", favourited heart |
| `footer-text` | `#D6DFD2` | Footer copy |

**Typography.** Inter at 400, 600 and 700 (self-hosted through `@fontsource/inter`, which includes Azerbaijani Latin
glyphs).

| Role | Size and line height | Weight |
| --- | --- | --- |
| Hero title | 40 / 1.15 (30 on 390) | 400 |
| Section title | 30 / 1.35 (23 on 390) | 400 |
| Section subtitle | 15 / 1.6 | 400, muted |
| Card price | 23 / 1.6 (20 on 390) | 400 |
| Card title | 15 / 1.6 (13 on 390) | 600 |
| Card meta | 12 / 1.6 (11 on 390) | 400, muted |
| Service price | 22 / 1.5 | 600 |
| Dialog and empty-state title | 23 / 1.35 | 400 |
| Field label | 13 / normal | 600 |
| Input | 14 / 1.5 | 400 |
| Button | 14 / normal | 600 |
| Badge | 12 / normal | 600 |
| Footer | 14 / 1.8–2, legal 12 / 1.8 | 400 |
| Wordmark | 25 (22 on 390) | 400 |

The components frame also documents the scale as "Başlıq 38/28 px · Əsas mətn 15 px · Sahə etiketi 13 px · Köməkçi mətn 12 px · Sətirarası məsafə 1,5".

**Spacing and shape**

* Page gutter: 64 px at 1440, 28 px at 768, 20 px at 390. The workflow header is 64 px.
* Section padding: 32 px vertical. The safety band is 40 px. The footer is 64, 28 and 24 px.
* Grid gaps: 12 px (categories, mobile cards) and 20 px (cards). The hero columns are 28 px apart.
* Radius: 8 px for buttons, fields, photos and notices. 12 px for cards and panels. 5 px for badges. Round 34 px favourite button.
* Controls: buttons have a minimum height of 46 px with 16×11 padding. Fields are 48 px tall with 13 px padding. Tabs and chips are at least 44 px with 12 px padding.
* Card hover: border `olive` plus `0 8px 24px rgba(23,63,50,.1)`.

**Icons.** Lucide glyphs with a 1.8 px stroke, except the wordmark leaf, header search, card hearts and select chevrons,
which use 1 px. Sizes are 16, 18, 20, 22, 25, 26 and 30 px. The full list appears in the outlines and covers: leaf,
search, heart, plus, chevron‑down/right, menu, house, circle‑plus, user‑round, trees, flower, flower‑2, sprout, wheat,
shovel, amphora, droplets, scissors, fence, shield‑check, eye, message‑circle, phone, share‑2, flag, upload, check,
arrow‑left/right, arrow‑down‑up, x.

---

## 4. Asset inventory

95 unique raster images (all JPEG sources from 1024 to 1584 px wide in Figma) are exported to `public/images/**` as WebP.
The exports total 2.2 MB. The mapping from Figma node to file is in [`docs/figma/image-manifest.json`](docs/figma/image-manifest.json).

| Folder | Files | What |
| --- | --- | --- |
| `listings/` | 48 | Product photos. Figma uses a different photo of the same product per frame and card size (1440 card, 768 card, 390 card, search card, detail gallery). Files are named `<product>-<n>` in frame order; `zeytun-agaci-gallery-1…4` are the detail gallery |
| `services/` | 21 | Service photos (catalogue, home 1440/768/390), the "Landşaft dizaynı" gallery (4) and portfolio (Mərdəkan, Novxanı) |
| `sellers/` | 11 | Seller card photos (3 frames × 3 sellers), Abşeron Tingçilik cover banner and profile card |
| `post-ad/` | 5 | 3 uploaded photos (step 3), preview (step 6), submitted card |
| `dashboard/` | 4 | Thumbnails in "Elanlarım" |
| `auth/` | 2 | Login and registration photos |
| `admin/` | 2 | Moderation review photo, complaint photo |
| `home/` | 1 | "Botanika vitrini" hero photo |
| `favorites/` | 1 | Saved service photo |

How images map to listings:

* Each listing keeps every photo the design attaches to it. `cover`, `coverTablet` and `coverMobile` are the photos on
  the 1440, 768 and 390 cards; `ListingCard` serves them with `<picture>`, so each breakpoint shows the Figma photo for
  that frame. `images` is the gallery in frame order, and `thumbnail` is the cabinet image. A few pages also have
  photos specific to their own frame (search, the "Oxşar elanlar" and seller grids), which are mapped per page in
  `src/features/*`.
* Services use the catalogue photo as `cover`. The home showcase uses the home‑frame photo.

---

## 5. Original data available in Figma

All of the following is reproduced verbatim in the typed data modules under `src/data/`.

* **Categories (10, with counts):** Ağaclar 428, Dekorativ bitkilər 312, Güllər 246, Tinglər və fidanlar 389, Çim və toxumlar 154, Torpaq və gübrələr 183, Dibçəklər və dekorasiya 221, Suvarma sistemləri 127, Bağ avadanlıqları 168, Landşaft və bağçılıq xidmətləri 252. Description for Ağaclar: "Dekorativ ağaclar, meyvə ağacları, iynəyarpaqlılar". Subcategory "Dekorativ ağaclar".
* **Cities:** Bakı, Abşeron, Sumqayıt, Gəncə, Şəki, Quba, Lənkəran. Addresses: Məhəmmədi qəsəbəsi, Nərimanov rayonu, Mərdəkan, Novxanı.
* **Product listings (16 public and 2 of the seller's own):**

  | Title | Price | Attributes | City |
  | --- | --- | --- | --- |
  | Zeytun ağacı — Olea europaea (VIP, № 10482, 248 views) | 145 ₼ | 180–200 sm · 5 yaş · dibçəkdə | Abşeron |
  | Mavi küknar — Picea pungens (VIP) | 85 ₼ | 100–120 sm · 3 yaş | Bakı |
  | Yapon ağcaqayını (VIP) | 120 ₼ | 120 sm · 4 yaş · qırmızı yarpaq | Quba |
  | Limon ağacı | 65 ₼ | 80–100 sm · meyvəli | Lənkəran |
  | Leyland sərvi | 38 ₼ | 100–120 sm · həmişəyaşıl | Sumqayıt |
  | Qızılgül fidanı | 12 ₼ | 40–60 sm · çəhrayı · dibçəkdə | Gəncə |
  | Monstera deliciosa | 45 ₼ | 60–80 sm · otaq bitkisi | Bakı |
  | Meyvə bağı üçün alma fidanı | 9 ₼ | 2 yaş · Golden Delicious | Şəki |
  | Terrakota dibçək | 28 ₼ | Ø 35 sm · təbii gil | Bakı |
  | Bağ üçün torpaq qarışığı | 8 ₼ | 20 litr · üzvi qarışıq | Abşeron |
  | Tuya — Smaragd (№ 10362, 176 views) | 55 ₼ | 140 sm · 3 yaş · dibçəkdə | Abşeron |
  | Dəfnə ağacı | 48 ₼ | 90 sm · 3 yaş · həmişəyaşıl | Abşeron |
  | Nar fidanı — Güleyşə | 15 ₼ | 80 sm · 2 yaş | Abşeron |
  | Üzvi kompost | 10 ₼ | 25 litr · ələnmiş | Abşeron |
  | İtalyan şamı | 160 ₼ | 200 sm · 5 yaş | Bakı |
  | Qaraçöhrə — Taxus baccata | 72 ₼ | 100 sm · 3 yaş · dibçəkdə | Bakı |

  The seller's own listings are "Leyland sərvi — 120 sm" (38 ₼, № 10524, pending) and "Lavanda fidanı" (7 ₼, № 10118,
  expired, 92 views). All public cards are dated "12 oktyabr". Zeytun ağacı additionally has full specifications, a
  two‑paragraph description and the price note "Bir ağac üçün · Satıcı ilə razılaşma əsasında".
* **Services (6):**

  | Service | Price | Provider | Areas |
  | --- | --- | --- | --- |
  | Landşaft dizaynı və yaşıllaşdırma (№ 20316) | 25 ₼/m²‑dən | Yaşıl Məkan Landşaft | Bakı, Abşeron, Sumqayıt |
  | Avtomatik suvarma quraşdırılması ("… sistemləri" on home) | 350 ₼‑dən | AquaBağ | Bakı, Abşeron |
  | Çim salınması və qulluq | 8 ₼/m²‑dən | Yaşıl Məkan Landşaft | Bakı, Sumqayıt |
  | Mövsümi bağ baxımı | 150 ₼‑dən | Bağ Ustası | Bakı, Abşeron |
  | Ağac əkilməsi | Razılaşma yolu ilə | Abşeron Tingçilik | Abşeron, Bakı |
  | Həyətyanı sahələrin yaşıllaşdırılması | 20 ₼/m²‑dən | Quba Bağ | Quba, Şəki |

  Landşaft dizaynı also has a description, a 6‑item checklist, a process text and 2 portfolio projects.
* **Sellers:**
  * Abşeron Tingçilik: Tingçilik təsərrüfatı, Abşeron, 24 active ads, since 2021, verified, contact Elvin Əliyev, +994 50 555 12 34, info@absheronting.az, hours, about text.
  * Yaşıl Bağ Mərkəzi: Bakı, 38 ads, verified.
  * Quba Fidan: Quba, 19 ads, verified.
  * Provider Yaşıl Məkan Landşaft: landscaping company since 2018, Nərimanov rayonu, B.e.–Şənbə 09:00–18:00.
* **People:** Elvin Əliyev (seller account, Abşeron Tingçilik) and Aysel Həsənova (moderator).
* **Dashboard figures:** 24 active, 1 in review, 2 expired, 1 284 views in 30 days; 7‑day chart for 6–12 Oct; "604 baxış · 42 nömrə göstərilməsi · əvvəlki həftədən 18% çox".

---

## 6. Missing resources and known gaps

1. **Image resolution.** Images are 1x renders of each image node, at exactly the size and crop the design displays (for
   example 396×210 cards and the 926×500 gallery). They look slightly soft on high‑DPI screens. The original 1024–1584 px
   sources exist in Figma but can only be downloaded from `www.figma.com`, which this environment blocks. **Fix:** allow
   `www.figma.com` in the environment's network settings and re‑export from the original fills. The node mapping is in
   `docs/figma/image-manifest.json`.
2. **Six render glitches, all on the search frame.** I diffed every export against the same region of its full‑frame
   render. Six search‑frame photos did not match: the single‑node render was half blank (`4:35327` Qaraçöhrə, `4:35342`
   Dəfnə) or zoomed in (`4:35311` Zeytun, `4:35319` Mavi küknar, `4:35332` Tuya, `4:35337` İtalyan şamı). Those six were
   cropped from the full‑frame render instead. The favourite‑button and VIP‑badge overlays baked into those crops were
   removed by patching about 40 px of neighbouring background. The other 89 exports match their frame region (mean pixel
   difference 2–8, which is compression noise).
3. **SVG icons.** These were not downloaded (same host). The build uses the identical Lucide glyphs.
4. **Responsive frames.** Only the home page has 768 and 390 frames. Mobile also has the filter sheet and favourites.
   Every other screen exists at 1440 only, so its tablet and mobile layouts are adaptations.
5. **Not specified in Figma.**
   * The category of each listing. It was inferred from the product type and is consistent with the search frame,
     where the 6 "Ağaclar" results match.
   * The seller of listings outside the Abşeron Tingçilik pages.
   * Specifications and descriptions for listings other than Zeytun ağacı, and for services other than Landşaft dizaynı.
   * Phone numbers other than the demo +994 50 555 12 34.
   * Sort option labels other than "Ən yenilər".
   * Pages behind "Elan statistikası", "Bütün satıcılar", the "Dəstək" footer links and "Şifrəni unutmusunuz?".

   None of these were invented as visible content. The UI hides sections without data, and the few interaction labels
   that had to be added are listed in `IMPLEMENTATION_REPORT.md`.
6. **Inconsistencies inside the design.**
   * Tuya — Smaragd is "12 oktyabr" on cards but "10 oktyabr 2026" in the cabinet.
   * The search frame overlaps "6 elan · çatdırılma ilə" with the view toggle.
   * The home grid shows 7 "Son elanlar" while the categories claim hundreds.

   The cabinet keeps its own Figma meta line, and the overlap is laid out cleanly.
7. **No prototype interactions, components, variables or styles.** A Plugin API check found 0 nodes with prototype
   reactions, 0 flows, 0 components or instances, 0 variable collections and 0 local paint, text or effect styles. The
   tokens in §3 were therefore read from raw fills and text properties. Behaviour comes from the component states sheet.

---

## 7. Implementation approach

* **Stack:** Vite 7, React 19, TypeScript 5.9, Tailwind CSS v4 with tokens from §3, React Router 7, and `lucide-react`.
  No UI kit was added.
* **Structure:**

  | Path | Contents |
  | --- | --- |
  | `src/app/` | Router and app state (favourites, mock session, user‑submitted ads; localStorage) |
  | `src/layouts/` | Home, main, auth, workflow and admin layouts, matching the four header and footer variants in Figma |
  | `src/components/` | UI primitives taken from the components frame, and cards |
  | `src/features/<area>/` | Page‑specific components |
  | `src/pages/` | Routes |
  | `src/data/` | Typed mock data copied from Figma |
  | `src/services/` | Query layer shaped like the future ASP.NET Core Web API endpoints |
  | `src/lib/` | Formatting and helpers |

* **Fidelity loop:** each screen was screenshotted with Playwright at 1440 (plus 768 and 390 where relevant) and compared
  side by side with the Figma render. The results are in `IMPLEMENTATION_REPORT.md`.
