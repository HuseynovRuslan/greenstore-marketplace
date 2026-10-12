# GreenStore — SEO architecture

This is the SEO foundation of the Next.js frontend. It is built for a nationwide classifieds marketplace, but it stays
**switched off** for now.

> **Current status: not indexable.** Every listing, seller and service is sample data from the Figma design. Until a
> real backend is connected and production readiness is confirmed, every page answers `noindex, nofollow`.
> `robots.txt` disallows all crawling and `sitemap.xml` is empty. Nothing here presents the sample listings to search
> engines as real inventory.

## 1. Switches (environment)

All switches live in [`src/seo/env.ts`](src/seo/env.ts). `next.config.ts`, the metadata helpers, `robots.ts` and
`sitemap.ts` all read them from this one place.

| Variable | Default | Effect |
| --- | --- | --- |
| `SEO_INDEXABLE` | `false` | Explicit opt-in for indexing. Set it to `true` only in the production environment, at launch. |
| `DATA_SOURCE` | `mock` | `mock` serves the Figma sample data. `api` selects the Web API repository, which does not exist yet; with `api` the server throws a clear error. **Indexing also requires `DATA_SOURCE` ≠ `mock`.** |
| `NEXT_PUBLIC_SITE_URL` | – | Public origin for canonical URLs, Open Graph, the sitemap and robots.txt. When it is unset, the Vercel production URL is used, then the deployment URL, then `http://localhost:3000`. No production domain is assumed. |
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Shows the "Demo versiya" banner. It does not affect indexing. |

`isIndexable()` returns true **only** when `SEO_INDEXABLE=true` and `DATA_SOURCE` is not `mock`. While it is false:

* every response carries `X-Robots-Tag: noindex, nofollow`, including images and non-HTML responses (`next.config.ts`);
* every page has `<meta name="robots" content="noindex, nofollow">` (`robotsFor()` in `src/seo/metadata.ts`);
* `robots.txt` is `User-Agent: * / Disallow: /`;
* `sitemap.xml` is a valid, empty `<urlset>`.

The private areas, `/kabinet`, `/secilmisler`, `/elan-yerlesdir`, `/idareetme`, `/daxil-ol` and `/qeydiyyat`, are
**always** `noindex` (header and meta), even after launch.

## 2. Rendering

Public pages are React Server Components. Their content, headings, prices, breadcrumbs and links are in the initial
HTML. Client components are small islands for interaction only.

| URL | Rendering | Server HTML contains |
| --- | --- | --- |
| `/` | Static | All home sections: categories, VIP and latest listings, services, sellers |
| `/elanlar` | Dynamic (query string) | Heading, result count, the result cards of the requested page, pagination links |
| `/kateqoriyalar/[kateqoriya]`, `/kateqoriyalar/[kateqoriya]/[seher]` | Dynamic (`?sehife`, sort, view) | Same as `/elanlar`, for one category (and city) |
| `/elanlar/[slug]` | SSG for every active listing (`generateStaticParams`) | Title, price, specs, description, seller, gallery, related listings |
| `/saticilar/[slug]` | Dynamic (tab, search, sort, page in the query) | Profile, contact panel, the seller's listing grid |
| `/xidmetler` | Dynamic (query string) | Heading, filters, service cards, pagination links |
| `/xidmetler/[slug]` | SSG for every service | Service description, areas, provider, portfolio |
| Private pages | Static frame, client content | Header, footer and an empty frame. The content depends on browser storage (demo session, favourites, draft) |

Metadata is in `<head>` of the first response. This was checked with a browser user agent on the dynamic routes (catalogue, category, seller, services, private pages).

## 3. URLs, canonicals and indexing rules

Every original Azerbaijani URL is kept. Rules for the catalogue live in [`src/seo/catalog.ts`](src/seo/catalog.ts)
and are covered by unit tests.

| URL | Robots | Canonical |
| --- | --- | --- |
| `/elanlar` | index, follow | `/elanlar` |
| `/elanlar?sehife=N` | index, follow | itself (`/elanlar?sehife=N`) |
| `/elanlar?kateqoriya=X` | same as the category page | `/kateqoriyalar/X` |
| `/elanlar?kateqoriya=X&seher=Y` (one city) | same as the category × city page | `/kateqoriyalar/X/Y`. Thin pages get no canonical (see below) |
| `/elanlar?q=…` (internal search) | noindex, follow | none |
| `/elanlar` with any other filter or combination (price, several cities, VIP, delivery, seller type, sub-category, species, height, age) | noindex, follow | none |
| `siralama`, `gorunus` | presentation only | ignored: the canonical drops them |
| `/kateqoriyalar/X` | index if the category has ≥ 1 active listing | itself (+ `?sehife=N`) |
| `/kateqoriyalar/X/Y` | index if the combination has ≥ 3 active listings | itself (+ `?sehife=N`) |
| `/elanlar/[slug]` | index | itself |
| `/saticilar/[slug]` | index; noindex, follow with `?kateqoriya` or `?q` | itself (+ `?sehife=N`); none for filtered variants |
| `/xidmetler` | index; noindex, follow with any filter | itself (+ `?sehife=N`); none for filtered variants |
| `/xidmetler/[slug]` | index | itself |

Why the rules are built this way:

* **Category pages instead of indexable filter URLs.** Filter combinations are unbounded, so they are `noindex,
  follow`. Crawlers still follow them to listings, but they do not compete in the index. The demand that matters,
  "category" and "category in a city", gets clean, stable URLs.
* **Inventory thresholds** (`MIN_LISTINGS_CATEGORY = 1`, `MIN_LISTINGS_CATEGORY_CITY = 3`). Empty or thin
  combinations would be soft-404 doorway pages. They still render with HTTP 200 for visitors, as `noindex`, and they
  are left out of the sitemap. Tune both numbers once real inventory exists.
* **No canonical on noindex pages.** Pointing a noindex page at another URL sends mixed signals.
* **Internal links.** Category cards and listing breadcrumbs link to `/kateqoriyalar/…`, so link equity flows to the
  indexable URLs. Changing a filter in the UI still produces `/elanlar?…` URLs, which keeps the behaviour of the
  approved design.

### Pagination

* Catalogue page size: 24 (`CATALOG_PAGE_SIZE`). Seller page: 6. Services: 6.
* Pagination is made of real `<a href="?sehife=N">` links, rendered on the server, plus `rel="next"` on "Növbəti".
  Each page is self-canonical. Page 1 has no `sehife` parameter.
* A page number beyond the last page returns **HTTP 404**. An invalid value (`0`, `abc`, `2.5`) is treated as page 1.

### HTTP status codes

| Case | Status |
| --- | --- |
| Unknown URL | 404 ("Səhifə tapılmadı") |
| Unknown listing, or a pending, expired or rejected listing | 404 ("Elan tapılmadı"). The signed-in demo owner still sees their own unpublished listing; the browser draws it after hydration from local data |
| Unknown seller, service, category or city | 404 |
| Page number out of range | 404 |
| `/elan-yerlesdir/<invalid step>` | 307 → `/elan-yerlesdir/1` |
| Missing image under `/images` | 404 |

## 4. Metadata

`pageMetadata()` in [`src/seo/metadata.ts`](src/seo/metadata.ts) builds the metadata for every public page:

* **Title.** Each page sets its own title, and the root template adds " — GreenStore". The home page uses the full
  site title. Paginated pages get "— səhifə N".
* **Description.** Built only from facts in the data, such as price, attributes, city and description, or the seller
  summary. It is trimmed to about 160 characters at a word boundary.
* **Canonical.** A path that `metadataBase` (from `NEXT_PUBLIC_SITE_URL`) turns into an absolute URL.
* **Open Graph and Twitter.** Type `website`, site name, locale `az_AZ`, `summary_large_image`. The image is the
  listing's first photo, the seller's cover or the service cover; other pages use the home "Botanika vitrini" photo.
* `<html lang="az">`. There are no `hreflang` alternates, because the site has one language.

## 5. Structured data (JSON-LD)

The builders are in [`src/seo/jsonld.ts`](src/seo/jsonld.ts) and render through `<JsonLd>`
([`src/seo/StructuredData.tsx`](src/seo/StructuredData.tsx)). `<JsonLd>` escapes `<`, so listing text can never break
out of the script tag.

| Page | Types | Properties |
| --- | --- | --- |
| Home | `WebSite` | name, url, description, inLanguage |
| Catalogue and category pages | `BreadcrumbList` | mirrors the visible breadcrumb |
| Listing | `BreadcrumbList`, `Product` + `Offer` | name, url, images, description, category; offer price + `AZN`, location (`availableAtOrFrom` with the city), business seller |
| Seller | `BreadcrumbList`, `LocalBusiness` (`Organization` without an address) | business sellers only: name, url, image, description, telephone, e-mail, address |
| Service | `BreadcrumbList`, `Service` | name, url, images, description, serviceType, areaServed, company provider |

Deliberately **not** emitted, because the data does not support it:

* reviews, ratings and `aggregateRating`;
* `availability`, `itemCondition`, `priceValidUntil` and brand;
* opening hours (the free-text "Hər gün 09:00–18:00" is not in schema.org format);
* offers for services (labels such as "25 ₼/m²-dən" are not prices);
* any data about individual (private-person) sellers.

Breadcrumb items that are in-page anchors (`/#saticilar`) are left out.

Structured data is emitted while the site is `noindex` as well, so it can be validated on staging with the Rich
Results Test. Search engines do not use it from noindex pages.

## 6. Sitemap and robots.txt

* `src/app/sitemap.ts` returns `buildSitemap(repository)` only when `isIndexable()`; otherwise the sitemap is empty.
  The sitemap contains:
  * the home page, `/elanlar` and `/xidmetler`;
  * category pages above the threshold;
  * every active listing, with `lastModified` from `publishedAt`;
  * every seller and every service.

  It never contains filtered, sorted, private or query-string URLs. Dates are only set where the data has one.
* `src/app/robots.ts`:
  * while not indexable, it disallows everything;
  * once indexable, it allows `/`, disallows the private areas, and announces the sitemap and host.
* Once the inventory exceeds 50,000 URLs, switch to `generateSitemaps()` (sitemap index) and read IDs and update dates
  from the API.

## 7. Security and caching headers

They are set in `next.config.ts`:

* on all responses: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`;
* in production builds: a `Content-Security-Policy`;
* `Cache-Control` of one hour for `/images/*`;
* the `X-Robots-Tag` rules described above.

**CSP note.** Next.js streams its RSC payload in inline scripts, so `script-src` includes `'unsafe-inline'`.
Removing it requires a per-request nonce (a `proxy.ts` that sets a nonce, with fully dynamic rendering). That is
planned hardening, not done yet. When the API runs on another origin, add it to `connect-src`.

## 8. Performance notes relevant to SEO

* Images are plain `<img>` / `<picture>` with the exact art direction from the design (desktop, tablet and mobile
  photos). `next/image` is deferred until photos come from object storage; then add a loader and `sizes`, and keep
  `priority` on the first gallery image.
* Inter is self-hosted (`@fontsource/inter`), so no third-party font requests are made.
* Static and SSG pages are served from the build cache. Dynamic catalogue pages render per request. With the real
  API, add `revalidate` / data caching per endpoint, or cache headers on the API, so crawl traffic does not hit the
  database on every request.

## 9. Launch checklist (when real data exists)

1. Implement `MarketplaceRepository` against the ASP.NET Core API (`src/services/repository.ts`) and deploy with
   `DATA_SOURCE=api`.
2. Set `NEXT_PUBLIC_SITE_URL` to the purchased production domain, for example `https://greenstore.az`, in the
   production environment only.
3. Set `NEXT_PUBLIC_DEMO_MODE=false`.
4. Set `SEO_INDEXABLE=true` **only in production**. Preview and staging keep `false`.
5. Check with `curl -sI https://<domain>/elanlar | grep -i x-robots` that there is no site-wide noindex; private paths
   still have it. Check that `/robots.txt` allows crawling and `/sitemap.xml` lists URLs.
6. Verify the domain in Google Search Console and Bing Webmaster Tools and submit the sitemap. Validate a listing page
   in the Rich Results Test.
7. Review the thresholds in `src/seo/catalog.ts` against real inventory. Consider indexable service-category pages
   once each category has enough services.
