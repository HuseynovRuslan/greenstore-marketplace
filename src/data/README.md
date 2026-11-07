# Demo data — not real

Everything in this folder is **sample data for the demo/staging build**. It was copied from the approved Figma design
(titles, prices, cities, sellers, phone numbers, statistics) so the screens can be reviewed without a backend.

* None of these listings, sellers, services, people, phone numbers or e-mail addresses are real records.
* `user.ts` is the demo seller account that every mock login signs in to (see `src/config/demo.ts`).
* Server-rendered pages read this data only through `MarketplaceRepository` (`src/services/repository.ts`). When the
  ASP.NET Core Web API is ready, implement that interface with API calls and select it with `DATA_SOURCE=api`.
* While this sample data is the data source (`DATA_SOURCE=mock`), every page is `noindex` and the sitemap is empty
  (`src/seo/env.ts`), so none of it is presented to search engines as real inventory.
