# Demo data — not real

Everything in this folder is **sample data for the demo/staging build**. It was copied from the approved Figma design
(titles, prices, cities, sellers, phone numbers, statistics) so the screens can be reviewed without a backend.

* None of these listings, sellers, services, people, phone numbers or e-mail addresses are real records.
* `user.ts` is the demo seller account that every mock login signs in to (see `src/config/demo.ts`).
* When the ASP.NET Core Web API is ready, replace these modules with API calls behind `src/services/`.
