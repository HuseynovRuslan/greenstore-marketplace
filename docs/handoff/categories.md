# Categories and home search filters — backend handoff

For: Ruslan (backend). Branch `nextjs-migration`, November 2026.
Source: management's spreadsheet `docs/data/kateqoriyalar-2026-11.xlsx` (sheets «Kateqoriyalar», «Alt kateqoriyalar»,
«Xüsusiyyətlər»). Management called it preliminary («hələlik belə olsun»), so expect changes.

Status: mock data only. The whole structure lives in one file, `src/data/categories.ts`; changing the list later is a
change to that file only. Two small additive contract changes, see [Contract changes](#contract-changes).

## Category list

Products are plants only. Ids are also the URL slugs (`/kateqoriyalar/{id}`, `?kateqoriya={id}`).

| # | id | Name | Kind | Icon (`IconName`) | Mock count* |
|---|---|---|---|---|---|
| 1 | `agaclar` | Ağaclar | product | `trees` | 16 |
| 2 | `kollar` | Kollar | product | `shrub` | 7 |
| 3 | `guller` | Güllər | product | `flower` | 7 |
| 4 | `sarmasiqlar` | Sarmaşıqlar | product | `grape` (new) | 7 |
| 5 | `yer-ortucu-bitkiler` | Yer örtücü bitkilər | product | `clover` (new) | 12 |
| 6 | `landsaft-xidmetleri` | Bağ xidmətləri | service | `fence` | 95 |

\* Product counts are no longer typed in: they are the number of active sample listings per category, counted on the
server through the repository (`listProductCategories`). «Bağ xidmətləri» keeps its mock total of 95
(`serviceListingTotal` in `src/data/services.ts`); the services themselves did not change.

- `guller` was «Güllər və çiçəklər»; the id is the same.
- Icons: Lucide has no ivy or climbing-plant icon, so «Sarmaşıqlar» uses `grape` (the vine).

## Sub-categories

Sub-category ids are unique across all categories: the category id, then the name without the category word, in
ASCII. The URL filter `alt` takes this id (`/elanlar?kateqoriya=kollar&alt=kollar-hemiseyasil`).

| Category | Sub-category id | Name |
|---|---|---|
| `agaclar` | `agaclar-meyve` | Meyvə ağacları |
| | `agaclar-enliyarpaqli-yarpaqtoken` | Enliyarpaqlı yarpaqtökən ağaclar |
| | `agaclar-enliyarpaqli-hemiseyasil` | Enliyarpaqlı həmişəyaşıl ağaclar |
| | `agaclar-iyneyarpaqli` | İynəyarpaqlı ağaclar |
| `kollar` | `kollar-yarpaqtoken` | Yarpaqtökən kollar |
| | `kollar-hemiseyasil` | Həmişəyaşıl kollar |
| `guller` | `guller-movsumi` | Mövsümi güllər |
| | `guller-coxillik` | Çoxillik güllər |
| `sarmasiqlar` | `sarmasiqlar-hemiseyasil` | Həmişəyaşıl sarmaşıqlar |
| | `sarmasiqlar-cicekli` | Çiçəkli sarmaşıqlar |
| | `sarmasiqlar-yarpaqtoken` | Yarpaqtökən sarmaşıqlar |
| `yer-ortucu-bitkiler` | `yer-ortucu-bitkiler-hemiseyasil` | Həmişəyaşıl |
| | `yer-ortucu-bitkiler-cicekli` | Çiçəkli |
| | `yer-ortucu-bitkiler-iyneyarpaqli` | İynəyarpaqlı |
| | `yer-ortucu-bitkiler-sukkulentler` | Sukkulentlər |
| | `yer-ortucu-bitkiler-ot-tipli` | Ot tipli |
| | `yer-ortucu-bitkiler-surunen-yarpaqli` | Sürünən yarpaqlı |

The names were cleaned up from the spreadsheet (capital letter at the start only; «Enliyarpaqlı - Yarpaqtökən
ağaclar» → «Enliyarpaqlı yarpaqtökən ağaclar»; Kollar and Sarmaşıqlar got their category word, «Yarpaqtökən» →
«Yarpaqtökən kollar»).

**Listings still carry the sub-category name.** `Listing.subcategory` and `ListingInput.subcategory` are unchanged
(the name, e.g. "Meyvə ağacları"); the frontend maps the name to the id. Proposal: the API sends the id as well (for
example `subcategoryId`), so a renamed sub-category does not break old listings. Please confirm before we change
the contract.

## Attribute «Kök sistemi»

From the «Xüsusiyyətlər» sheet: for Ağaclar and Kollar it is a search filter and a required field when posting.

| | Value |
|---|---|
| Options | Dibçəkdə · Torpaq kürəsi ilə · Açıq kök |
| URL filter (`/elanlar`) | `kok=dibcek` · `kok=torpaq-kuresi` · `kok=aciq-kok` |
| Contract value (`PlantFacts.rootSystem`) | `container` · `rootball` · `bare-root` |
| Filter shown for | `agaclar`, `kollar` (and whenever `kok` is in the URL, so it can be cleared) |
| Required when posting | `agaclar`, `kollar`; optional for the other plant categories |
| Proposed API query param | `rootSystem` (the contract value) |

- **Posting** sends it in `ListingInput.plant.rootSystem` (and the raw form value in `attributes.rootSystem`). The
  wizard's options and the filter's options are now one list, so the earlier question about two sets of values is
  settled for this attribute.
- **Changing the filter category** keeps `kok` only when the new category has the filter.
- The rules live in `src/data/categories.ts` (`attributes.rootSystem: { filter, required }` per category).
- The other plant attributes (height, age, species, pot size, availability, care) stay as before for all five
  categories; «Yarpaq» (həmişəyaşıl / yarpaqtökən) is asked for every plant category except Güllər.

## What was removed

Taken off the site «for now»:

| id | Name | Old URL now |
|---|---|---|
| `otaq-bitkileri` | Otaq bitkiləri | 307 → `/elanlar` |
| `tingler-fidanlar` | Fidan və toxum | 307 → `/elanlar` |
| `cim-toxumlar` | Rulon çəmən | 307 → `/elanlar` |
| `torpaq-gubreler` | Gübrə və torpaq | 307 → `/elanlar` |
| `bag-avadanliqlari` | Bağ alətləri | 307 → `/elanlar` |
| `suvarma-sistemleri` | Suvarma | 307 → `/elanlar` |

- `/kateqoriyalar/{id}/{city}` goes to `/elanlar?seher={city}`.
- The redirects are temporary (307), because a category may come back. They are generated from
  `retiredCategoryIds` in `src/data/categories.ts` (`next.config.ts`).
- `/elanlar?kateqoriya={old id}` shows all products (the unknown id is ignored).
- Services (`/xidmetler`, «Bağ xidmətləri») are unchanged.
- **Real data:** listings in these categories need a decision (move, hide or keep under a hidden category).

### Sample listings moved or removed

| Listing id | Before | Now |
|---|---|---|
| `zeytun-agaci` | Ağaclar / Dekorativ ağaclar | Ağaclar / Meyvə ağacları |
| `limon-agaci` | Ağaclar | Ağaclar / Meyvə ağacları |
| `alma-fidani` | Fidan və toxum | Ağaclar / Meyvə ağacları |
| `nar-fidani` | Fidan və toxum | Ağaclar / Meyvə ağacları |
| `yapon-agcaqayini` | Ağaclar | Ağaclar / Enliyarpaqlı yarpaqtökən ağaclar |
| `defne-agaci` | Ağaclar / Dekorativ ağaclar | Ağaclar / Enliyarpaqlı həmişəyaşıl ağaclar |
| `mavi-kuknar`, `tuya-smaragd`, `italyan-sami`, `qaracohre` | Ağaclar / Dekorativ ağaclar | Ağaclar / İynəyarpaqlı ağaclar |
| `leyland-servi` | Ağaclar | Ağaclar / İynəyarpaqlı ağaclar |
| `qizilgul-fidani` | Güllər və çiçəklər | Güllər / Çoxillik güllər |
| `leyland-servi-120` (pending) | Ağaclar | Ağaclar / İynəyarpaqlı ağaclar |
| `sarv-tingleri-topdan` (rejected), `yasil-hasar-paketi` (inactive) | Ağaclar / İynəyarpaqlılar | Ağaclar / İynəyarpaqlı ağaclar |
| `lavanda-fidani` (expired) | Fidan və toxum | Kollar / Həmişəyaşıl kollar |
| `monstera-deliciosa` | Otaq bitkiləri | **removed** (a house plant fits no new category) |
| `terrakota-dibcek` | Bağ alətləri | **removed** |
| `torpaq-qarisigi` | Gübrə və torpaq | **removed** |
| `uzvi-kompost` | Gübrə və torpaq | **removed** |

Other sample data that pointed at removed items: moderation item № 10522 «Bağ üçün çim toxumu» is now «Sürünən floks
tingləri» (`yer-ortucu-bitkiler`); complaint Ş-182 now points at the demo listing `petuniya` (№ 10452); the demo
account's favourites swap the pot and the Monstera for `limon-agaci` and `qizilgul-fidani`; Abşeron Tingçilik's
seller tabs are counted from its listings (the Figma tabs named two removed categories). The photos of the removed
listings stay in `public/images/listings` in case the categories come back.

## Demo listings (to confirm with management)

The «Nümunələr» column was mostly empty, so the sample listings for the new sub-categories use these example plants.
They are **demo data**: `src/data/demoListings.ts`, ids below, numbers № 10440–10476, dated 4–11 October 2026 (older
than the photographed Figma listings, which therefore stay first). None of them has a real photo: each shows its
category's neutral placeholder (the category icon on mint, `/images/listings/placeholder-{category id}.webp`).
Prices, sizes, sellers and phone numbers are made up. **Management should confirm the example plants per
sub-category.** Every sub-category has at least two listings, so no filter opens an empty page.

| Sub-category | Demo listings (id) | Listings with a photo already there |
|---|---|---|
| Meyvə ağacları | — | Zeytun, Limon, Alma, Nar |
| Enliyarpaqlı yarpaqtökən ağaclar | Çinar `cinar`, Cökə `coke`, Şabalıd `sabalid` | Yapon ağcaqayını |
| Enliyarpaqlı həmişəyaşıl ağaclar | Maqnoliya `maqnoliya`, Daş palıd `das-palid` | Dəfnə ağacı |
| İynəyarpaqlı ağaclar | — | Leyland sərvi, Mavi küknar, Tuya, İtalyan şamı, Qaraçöhrə |
| Yarpaqtökən kollar | Bərbəris `berberis`, Hortenziya `hortenziya`, Spireya `spireya`, Yasəmən `yasemen` | |
| Həmişəyaşıl kollar | Şümşad `sumsad`, Fotiniya `fotiniya`, Lavanda `lavanda` | |
| Mövsümi güllər | Petuniya `petuniya`, Bənövşə `benovse`, Məxmərgül `mexmergul`, Begoniya `begoniya` | |
| Çoxillik güllər | Şaqayıq `saqayiq`, Zanbaq `zanbaq` | Qızılgül |
| Həmişəyaşıl sarmaşıqlar | Adi sarmaşıq (Hedera) `adi-sarmasiq`, Ulduz jasmini `ulduz-jasmini` | |
| Çiçəkli sarmaşıqlar | Bugenvilleya `bugenvilleya`, Vistariya `vistariya`, Klematis `klematis` | |
| Yarpaqtökən sarmaşıqlar | Qız üzümü `qiz-uzumu`, Kampsis `kampsis` | |
| Yer örtücü · Həmişəyaşıl | Vinka `vinka`, Vinka (Vinca major) `vinka-variegata` | |
| Yer örtücü · Çiçəkli | Sürünən floks `surunen-floks`, Gazaniya `gazaniya` | |
| Yer örtücü · İynəyarpaqlı | Sürünən ardıc ×2 `surunen-ardic-blue-chip`, `surunen-ardic-nana` | |
| Yer örtücü · Sukkulentlər | Sedum `sedum`, Delosperma `delosperma` | |
| Yer örtücü · Ot tipli | Festuka `festuka`, Ofiopoqon `ofiopoqon` | |
| Yer örtücü · Sürünən yarpaqlı | Lizimaxiya `lizimaxiya`, Dixondra `dixondra` | |

Vinka and Sürünən ardıc had one example each, so each has two listings of different varieties.

## Contract changes

Approved on 9 November 2026; both are additive.

| Where | Change | Why |
|---|---|---|
| `IconName` (`src/types/index.ts`) | added `'grape'` (Lucide `Grape`) and `'clover'` (Lucide `Clover`) | icons for «Sarmaşıqlar» and «Yer örtücü bitkilər». The admin icon picker labels them «Tənək» and «Yonca». Old icon names stay valid. |
| `SearchState` (input of `repository.searchListings`) | added `root` (`kok`) | the «Kök sistemi» filter. `ListingFilters` (`src/services/marketplace.ts`) got `rootSystem`. |

If the API sends the category icon as a string, it must accept `grape` and `clover`.

## Counts the home page shows

- **Categories row:** the five plant categories with their counts from `listProductCategories()`.
- **Tabs:** «Məhsullar» is the sum of the category counts (49), «Xidmətlər» the services catalogue's total (95),
  «Hamısı» both (144). `src/features/home/heroCounts.ts`.
- **Cities:** the city field shows product listings per city, counted with `searchListings` (one call per city);
  «Bütün şəhərlər» shows the product total. The old typed-in `cityListingCounts` is gone.
- **Contract change to discuss** (unchanged): serving these numbers from the API, for example as facet counts in
  the search response. Until then the frontend counts through the existing repository methods.

## Query parameters the home search sends today

`/elanlar`:

| Parameter | Content |
|---|---|
| `q` | search text |
| `seher` | city id |
| `kateqoriya` | category id |
| `min`, `max` | price in ₼ |
| `hundurluk` | height range in cm (see the values below) |
| `catdirilma=1` | delivery available |

`hundurluk` values: `-100` (up to 1 m), `100-200`, `200-300`, `300-`.

The catalogue reads the same names (`PARAM` in `src/features/search/filterDefs.ts`) plus `alt` (sub-category id),
`kok`, `nov`, `yas`, `vip`, `saticiNovu`, `siralama`, `gorunus` and `sehife`; see [elanlar.md](elanlar.md).

`/xidmetler`: `q`, `seher` (the page reads `erazi` and falls back to `seher`), `kateqoriya` (service category),
`min`, `max`.

«Hamısı» has no combined products + services results page, so it submits to `/elanlar`. Should there be one?

## Filters waiting for backend

The frontend does **not send** these filters yet and does not show them: the results page could not apply them.
They are behind one constant, `SHOW_PENDING_FILTERS` in `src/features/home/heroSearch.ts`, now `false`.

| Filter (UI) | Proposed param | Values | Applies to | Needs on the DTO |
|---|---|---|---|---|
| Mövcudluq | `movcudluq` | `satisda` (Satışdadır), `sifarisle` (Sifarişlə) | `/elanlar`, `/xidmetler` | availability |
| Əkin daxil | `ekin=1` | flag | `/elanlar`, `/xidmetler` | "planting included" flag |
| Çatdırılma (services) | `catdirilma=1` | flag, same name as on `/elanlar` | `/xidmetler` | `Service` has no delivery field (`Listing.deliveryAvailable` exists) |

- «Kök sistemi» left this table: since November 2026 it is a catalogue filter (`kok`, above). Its chip on the home
  page is still hidden with the others; say if it should come back.
- The post-ad wizard already uses the same Mövcudluq values (`availabilityOptions`).
