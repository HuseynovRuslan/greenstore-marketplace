# Categories and home search filters — backend handoff

For: Ruslan (backend). Frontend commit: `9bcb5d9 feat(data): Variant 2 categories…` (branch `nextjs-migration`).
Status: mock data only (`src/data`). One small type change, see [Type changes](#type-changes);
`src/services/repository.ts` is unchanged.

## Category list (Variant 2 home page)

Ids are also the URL slugs (`/kateqoriyalar/{id}`, `?kateqoriya={id}`). Ids that existed before were kept, so their
URLs still work; only the display names and counts changed. Counts are mock platform totals.

| # | id | Name | Kind | Mock count | Icon (`IconName`) |
|---|---|---|---|---|---|
| 1 | `agaclar` | Ağaclar | product | 1 240 | `trees` |
| 2 | `kollar` | Kollar | product | 860 | `shrub` (new) |
| 3 | `guller` | Güllər və çiçəklər | product | 530 | `flower` |
| 4 | `otaq-bitkileri` | Otaq bitkiləri | product | 410 | `amphora` |
| 5 | `tingler-fidanlar` | Fidan və toxum | product | 290 | `sprout` |
| 6 | `cim-toxumlar` | Rulon çəmən | product | 75 | `wheat` |
| 7 | `torpaq-gubreler` | Gübrə və torpaq | product | 180 | `shovel` |
| 8 | `bag-avadanliqlari` | Bağ alətləri | product | 220 | `scissors` |
| 9 | `suvarma-sistemleri` | Suvarma | product | 140 | `droplets` |
| 10 | `landsaft-xidmetleri` | Bağ xidmətləri | service | 95 | `fence` |

- **Added:** `kollar`, `otaq-bitkileri`.
- **Removed:** `dekorativ-bitkiler` (Dekorativ bitkilər), `dibcekler-dekorasiya` (Dibçəklər və dekorasiya).
  Their category pages now return 404. There are no redirects (demo data).
- **Moved listings:**
  - `monstera-deliciosa` (was `dekorativ-bitkiler`) → `otaq-bitkileri`.
  - `terrakota-dibcek` (was `dibcekler-dekorasiya`) → `bag-avadanliqlari`. That category gained the sub-category
    "Dibçəklər və dekor" for pots; the mock listing itself has no sub-category set.
- **Sub-categories:** the lists for `kollar` and `otaq-bitkileri` are placeholders. Please replace them with the real
  taxonomy. The other lists are unchanged.
- **Real data:** if real listings already use the two removed ids, they need the same mapping. Also decide whether
  to redirect the old URLs.

## Type changes

| Type | Change | Why |
|---|---|---|
| `IconName` (`src/types/index.ts`) | added `'shrub'` (Lucide `Shrub`) | icon for «Kollar». The other nine categories keep their icons. `'flower-2'` stays valid but no category uses it now. |

If the API sends the category icon as a string, it must accept `shrub` too. The admin icon picker labels it «Kol».

## Counts the home page shows

- **Tabs:** «Hamısı / Məhsullar / Xidmətlər» are sums of the category counts: 4 040 / 3 945 / 95.
- **Cities:** the city field shows a count per city. `City` has no count field, so the counts sit in a frontend map,
  `cityListingCounts` in `src/data/cities.ts`. They add up to 4 040.
- **Contract change to discuss:** the home page reads these numbers from `src/data`, like before. Serving them from
  the API means a contract change. For example, the home response could carry category and city counts, or a facet
  endpoint could return them. We have not made that change yet.

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

The catalogue reads the same names (`PARAM` in `src/features/search/filterDefs.ts`) plus `alt`, `nov`, `yas`, `vip`,
`saticiNovu`, `siralama`, `gorunus` and `sehife`; see [elanlar.md](elanlar.md).

`/xidmetler`: `q`, `seher` (the page reads `erazi` and falls back to `seher`), `kateqoriya` (service category),
`min`, `max`.

«Hamısı» has no combined products + services results page, so it submits to `/elanlar`. Should there be one?

## Filters waiting for backend

The frontend does **not send** these filters yet, and since 6 November 2026 it does not show them either: the
results page could not apply them, so a choice made on the home page was silently lost. They are behind one
constant, `SHOW_PENDING_FILTERS` in `src/features/home/heroSearch.ts`, now `false`. The code stays; setting it to
`true` shows them again on the home page. Once the params below are confirmed, they will be added to the catalogue
filters too.

| Filter (UI) | Proposed param | Values | Applies to | Needs on the DTO |
|---|---|---|---|---|
| Kök sistemi | `kok` | `dibcek` (Dibçəkdə), `torpaq-kuresi` (Torpaq kürəsi ilə), `aciq-kok` (Açıq kök) | `/elanlar`, plant categories | listing root type |
| Mövcudluq | `movcudluq` | `satisda` (Satışdadır), `sifarisle` (Sifarişlə) | `/elanlar`, `/xidmetler` | availability |
| Əkin daxil | `ekin=1` | flag | `/elanlar`, `/xidmetler` | "planting included" flag |
| Çatdırılma (services) | `catdirilma=1` | flag, same name as on `/elanlar` | `/xidmetler` | `Service` has no delivery field (`Listing.deliveryAvailable` exists) |

Notes:
- **`kok`:** the admin category data already uses the filter id `kok` ("Kök forması") for `tingler-fidanlar`, so the
  name matches.
- **Wizard values differ from the filter values:**
  - The post-ad wizard asks for growing form, `Dibçəkdə` / `Açıq sahədə` (`growingForms`).
  - It also asks for availability, `Satışda` / `Sifarişlə` (`availabilityOptions`).
  - The filter values differ. It has «Torpaq kürəsi ilə» and «Açıq kök», and «Satışdadır» instead of «Satışda».
  - Please confirm one set of values for both the form and the filter.
- **Values are proposals:** the param names and values above are proposals only. Nothing reads or sends them until
  you confirm.
