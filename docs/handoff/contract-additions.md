# Contract additions — Nov 2026 (for Ruslan)

The "everything else" pass (posting flow, auth, listing / seller pages, cabinet, promotion, services) needed data the
API contract didn't have. Every change below is **additive**: new optional fields, new types, new repository methods.
Nothing was renamed or removed. Source of truth: [`src/types/index.ts`](../../src/types/index.ts) (bottom section,
"Plant-world additions") and [`src/services/repository.ts`](../../src/services/repository.ts) (bottom of
`MarketplaceRepository`). The mock implementation is in [`src/services/mockRepository.ts`](../../src/services/mockRepository.ts)
and [`src/services/mockWrites.ts`](../../src/services/mockWrites.ts).

**Mock vs real.** Writes are called from Next.js Server Actions (`src/features/**/actions.ts`). In `DATA_SOURCE=mock`
they validate and answer like the API would, but **store nothing**: the demo keeps the user's own data (session,
favourites, saved searches, posted listings, promotions bought) in the browser's localStorage. No SMS, e-mail or
payment is ever sent.

Entries are added here as each step lands; the step that needed them is named in brackets.

## 1. Types

### `ListingStatus` gets `'draft'` [cabinet]

`'active' | 'pending' | 'rejected' | 'expired' | 'inactive' | 'draft'`. A draft is a listing started in
«Elan yerləşdir» and not sent; only its owner sees it. Adding a union member is the one change that can break
exhaustive `switch`/`Record` code on your side — please check.

### New optional `Listing` fields [posting, listing page, cabinet]

| Field | Type | Why |
|---|---|---|
| `updatedAt` | ISO string | «Yeniləndi: 28 oktyabr» on the listing page; set on edit and renewal |
| `expiresAt` | ISO string | Listing lifetime (30 days); «4 gün qalıb» and «Müddəti bitib» in the cabinet |
| `bumpedAt` | ISO string | Last «İrəli çək»; «Ən yenilər» should sort by `max(publishedAt, bumpedAt)` |
| `priceType` | `'fixed' \| 'negotiable' \| 'agreement'` | «Qiymət razılaşma ilə», and price-less listings (`price` 0 today — see follow-ups) |
| `priceUnit` | `'piece' \| 'kg' \| 'litre' \| 'sqm' \| 'bag' \| 'set' \| 'metre' \| 'hour' \| 'job'` | «38 ₼ / ədəd», «8 ₼ / kisə», «6 ₼ / m²»; services «20 ₼ / saat», «350 ₼ / iş» |
| `wholesale` | `{ price, minQuantity }` | «Topdan: 32 ₼ / ədəd, 20 ədəddən» |
| `quantityAvailable` | number | «Stokda: 300 ədəd» |
| `area` | string | Village / district after the city: «Abşeron, Məhəmmədi qəsəbəsi» |
| `plant` | `PlantFacts` | Attributes table + care block (below) |
| `careTips` | string[] | The seller's own care tips |
| `plantingAvailable` | boolean | «Əkin xidməti var» |
| `deliveryAreas` | string | «Çatdırılma: Bakı və Abşeron» (`deliveryAvailable` stays the flag) |
| `contactName`, `contactPhone` | string | Contact for listings without a seller profile (individuals) |
| `whatsapp` | boolean | Show «WhatsApp-a yaz» |
| `phoneHidden` | boolean | Seller hides the number; buyers can only write on WhatsApp |
| `promotion` | `{ packageId, until }` | Running «Önə çıxar» / bundle; `vip` stays the public flag |
| `rejectionReason` | string | Moderator's reason shown to the owner, status `rejected` |
| `stats` | `ListingStats` | Owner only; never on public endpoints |

```json
{
  "id": "zeytun-agaci",
  "price": 145,
  "priceType": "negotiable",
  "priceUnit": "piece",
  "wholesale": { "price": 130, "minQuantity": 10 },
  "quantityAvailable": 40,
  "area": "Məhəmmədi qəsəbəsi",
  "updatedAt": "2026-10-28T10:15:00",
  "expiresAt": "2026-11-27T10:15:00",
  "plant": {
    "species": "Olea europaea",
    "heightCm": { "min": 180, "max": 200 },
    "ageYears": 5,
    "rootSystem": "container",
    "potLitres": 45,
    "sun": "full-sun",
    "water": "low",
    "frostHardinessC": -10,
    "foliage": "evergreen",
    "plantingMonths": [3, 4, 5, 9, 10]
  },
  "careTips": ["Əkindən sonra ilk ay həftədə 2 dəfə bol suvarın, sonra torpaq quruduqca."],
  "deliveryAreas": "Bakı və Abşeron",
  "plantingAvailable": true,
  "whatsapp": true,
  "promotion": { "packageId": "one-cixar", "until": "2026-11-14T10:15:00" }
}
```

`PlantFacts` enums: `rootSystem` `container` (dibçəkdə) / `rootball` (torpaq kürəsi ilə) / `bare-root` (açıq kök);
`sun` `full-sun` / `part-shade` / `shade`; `water` `low` / `medium` / `high`; `foliage` `evergreen` / `deciduous`.
The catalogue's pending «Kök sistemi» filter can use `plant.rootSystem`.

### New optional `Seller` fields [seller page, registration]

| Field | Type | Why |
|---|---|---|
| `businessKind` | `'nursery' \| 'garden-centre' \| 'landscaping'` | Registration choice; directory filter. `kind` keeps the display text |
| `logo` | path | Square logo; the UI falls back to initials |
| `hours` | `OpeningHours[]` | Weekly table and «İndi açıqdır» on the seller page |
| `whatsapp` | boolean | WhatsApp button on the seller page |
| `instagram`, `website` | string | Links on the seller page |
| `location` | `{ lat, lng }` | «Xəritədə aç» link |
| `offers` | `('delivery' \| 'planting' \| 'design' \| 'wholesale' \| 'care')[]` | Service chips on the seller page |
| `responseMinutes` | number | «Adətən 1 saat ərzində cavab verir» |
| `serviceIds` | string[] | The business's services on /xidmetler |

```json
{
  "id": "abseron-tingcilik",
  "businessKind": "nursery",
  "hours": [{ "day": 1, "open": "09:00", "close": "18:00" }, { "day": 7, "closed": true }],
  "whatsapp": true,
  "instagram": "absheron.tingcilik",
  "location": { "lat": 40.5281, "lng": 49.9215 },
  "offers": ["delivery", "planting", "wholesale", "care"],
  "responseMinutes": 60,
  "serviceIds": ["agac-ekilmesi"]
}
```

### New types

`PromotionPackage`, `PromotionOption`, `PromotionOrder`, `ListingStats`, `ListingInput`, `ListingSubmitResult`,
`OtpChallenge`, `OtpVerifyResult`, `OtpPurpose`, `RegistrationInput`, `ReportInput`, `ServiceRequestInput`,
`ServiceRequestResult`, `SavedSearch`, `SupportMessageInput`, `BusinessKind`, `SellerOffer`, `OpeningHours`. Shapes and comments are in
`src/types/index.ts`.

## 2. Repository methods

| Method | Mock behaviour | Real API (suggested) |
|---|---|---|
| `listProviderServices(providerId)` | filters the sample services | `GET /api/providers/{id}/services` |
| `listOwnListings(sellerId)` | the seller's sample listings in every status | `GET /api/me/listings` (session decides the seller) |
| `getListingStats(listingId)` | deterministic numbers from the listing's views | `GET /api/me/listings/{id}/stats` |
| `listPromotionPackages()` | `src/data/promotions.ts` | `GET /api/promotions` |
| `submitListing(input)` | checks required fields, returns the next number, status `pending` | `POST /api/listings` |
| `revealPhone(listingId)` | returns the number unless `phoneHidden` | `POST /api/listings/{id}/phone-reveals` (counts reveals) |
| `createPromotionOrder(input)` | prices the option, status `paid` at once | `POST /api/promotion-orders` → payment provider redirect |
| `submitReport(input)` | returns an id | `POST /api/reports` |
| `submitServiceRequest(input)` | returns «Sorğu № 3021…» | `POST /api/service-requests` |
| `submitSupportMessage(input)` | returns a ticket number [footer pages] | `POST /api/support` (to the support inbox) |
| `requestOtp({ phone, purpose })` | challenge id, masked phone, 300 s expiry, 60 s resend, **`demoCode: "1234"`** | `POST /api/otp` (sends the SMS; never returns the code) |
| `verifyOtp({ challengeId, code })` | accepts `1234`; 5 attempts; expires after 5 min | `POST /api/otp/verify` |
| `register(input)` | needs a recent verified challenge | `POST /api/accounts` |
| `resetPassword(input)` | needs a recent verified challenge | `POST /api/accounts/password-reset` |

Example `ListingInput` (`POST /api/listings`):

```json
{
  "kind": "product",
  "categoryId": "agaclar",
  "subcategory": "İynəyarpaqlı ağaclar",
  "title": "Tuya Smaragd — 140 sm, dibçəkdə",
  "description": "Sağlam, sıx formalı tinglər…",
  "attributes": { "rootSystem": "container", "potLitres": "15", "heightMin": "140", "ageYears": "3" },
  "plant": { "heightCm": { "min": 140 }, "ageYears": 3, "rootSystem": "container", "potLitres": 15, "sun": "full-sun" },
  "priceType": "fixed",
  "price": 55,
  "priceUnit": "piece",
  "wholesale": { "price": 48, "minQuantity": 20 },
  "cityId": "abseron",
  "area": "Məhəmmədi",
  "deliveryAvailable": true,
  "deliveryAreas": "Bakı və Abşeron",
  "plantingAvailable": true,
  "contactName": "Elvin Əliyev",
  "contactPhone": "+994505551234",
  "whatsapp": true,
  "phoneHidden": false,
  "photoIds": ["ph_81f2", "ph_81f3"],
  "promotion": { "packageId": "one-cixar", "optionId": "one-cixar-7" }
}
```

Example `OtpChallenge` (mock):

```json
{ "challengeId": "otp.505551234.1762509600000", "phoneMasked": "+994 50 *** ** 34", "expiresInSec": 300, "resendInSec": 60, "demoCode": "1234" }
```

## 3. Not in the contract (browser-only in the demo)

These live in localStorage and need endpoints later; the UI is ready for them:

- favourites (existing), **saved searches** (`SavedSearch[]`) with the alert switch;
- the wizard draft (autosave) — a server draft would use status `draft`;
- the cabinet's own actions (renew, deactivate, delete, promote) on sample listings — overrides kept per browser;
- photo upload: files stay as `blob:` URLs; the API needs `POST /api/photos` returning ids for `photoIds`.

## 4. Open questions

See [follow-ups.md](follow-ups.md) → «Questions for the backend».
