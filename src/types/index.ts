/**
 * Domain types for the GreenStore marketplace.
 * Shapes are intentionally close to what an ASP.NET Core Web API would return (camelCase JSON DTOs),
 * so the mock data modules in `src/data` can later be swapped for HTTP calls in `src/services`.
 */

/**
 * Lucide icon names used by the Figma design (e.g. category cards). `shrub` was added for "Kollar" (Variant 2);
 * `grape` («Sarmaşıqlar», the vine) and `clover` («Yer örtücü bitkilər») for the November 2026 categories.
 */
export type IconName =
  | 'trees'
  | 'shrub'
  | 'flower-2'
  | 'flower'
  | 'grape'
  | 'clover'
  | 'sprout'
  | 'wheat'
  | 'shovel'
  | 'amphora'
  | 'droplets'
  | 'scissors'
  | 'fence'

export type CategoryKind = 'product' | 'service'

export interface Category {
  id: string
  slug: string
  name: string
  icon: IconName
  /** "428 elan" on the home page category cards */
  listingCount: number
  kind: CategoryKind
  /** Short description (shown on the category info panel in the components frame) */
  description?: string
}

export interface City {
  id: string
  name: string
}

/** `draft` (added Nov 2026): started in «Elan yerləşdir» but not sent; only the owner sees it. */
export type ListingStatus = 'active' | 'pending' | 'rejected' | 'expired' | 'inactive' | 'draft'

export interface Spec {
  label: string
  value: string
}

export interface Listing {
  id: string
  slug: string
  /** "Elan № 10482" */
  number?: number
  title: string
  /** Price in AZN (₼) */
  price: number
  /** Line under the price on the detail page, e.g. "Bir ağac üçün · Satıcı ilə razılaşma əsasında" */
  priceNote?: string
  /** Card sub-line, e.g. ["180–200 sm", "5 yaş", "dibçəkdə"] */
  attributes: string[]
  cityId: string
  /** ISO date the listing was published */
  publishedAt: string
  /** Promoted listing — shown in "Önə çıxan elanlar" with the "Önə çıxan" badge (`?vip=1` in URLs) */
  vip: boolean
  categoryId: string
  /** Sub-category name, e.g. "Meyvə ağacları" (detail page breadcrumb/specs; ids: src/data/categories.ts) */
  subcategory?: string
  /**
   * Sub-category id, e.g. "agaclar-meyve" (backend-contract.md 1.3): stays right when the sub-category is renamed.
   * Sent by the API; the mock derives it from `subcategory`.
   */
  subcategoryId?: string
  sellerId?: string
  /** Image used on listing cards (path under /public) — the photo of the 1440 desktop frames */
  cover: string
  /** Card photo the 768 tablet frame uses for this listing (served by ListingCard below 1280 px) */
  coverTablet?: string
  /** Card photo the 390 mobile frames use for this listing (served by ListingCard below 768 px) */
  coverMobile?: string
  /** Thumbnail used in the seller cabinet list ("Şəxsi kabinet" → "Elanlarım"), when Figma has a dedicated one */
  thumbnail?: string
  /** Gallery images in original order (cover is not repeated unless it is part of the gallery) */
  images: string[]
  description?: string[]
  specs?: Spec[]
  deliveryAvailable?: boolean
  status: ListingStatus
  views?: number
}

export type SellerType = 'business' | 'individual'

export interface Seller {
  id: string
  slug: string
  name: string
  /** e.g. "Tingçilik təsərrüfatı" (only when stated in Figma) */
  kind?: string
  type: SellerType
  cityId: string
  activeListings: number
  verified: boolean
  /** Year the seller joined ("2021-dən ... -da") */
  memberSince?: number
  /** Card image (home page "Etibar etdiyiniz satıcılar") */
  image: string
  /** Wide cover photo on the public seller page */
  coverImage?: string
  /**
   * The business's number. Never in public reads (backend-contract.md 3.1, decision 4): pages get `phoneMasked` and
   * the number itself only from `revealSellerPhone` after «Nömrəni göstər». Admin data and the demo data keep it.
   */
  phone?: string
  /** "+994 50 *** ** 34" when the seller has a number (public reads, backend-contract.md 3.1) */
  phoneMasked?: string
  email?: string
  about?: string
  /** Second paragraph on the public seller page (delivery / visiting hours) */
  terms?: string
  address?: string
  workingHours?: string
  contactPerson?: string
}

export interface ServiceProvider {
  id: string
  name: string
  verified: boolean
  /** Set when the provider also has a public seller page */
  sellerId?: string
  /** "Landşaft şirkəti · 2018-ci ildən fəaliyyət göstərir · Bakı, Nərimanov rayonu" */
  summary?: string
  workingHours?: string
  /** Never in public reads (backend-contract.md 3.1): the number comes from `revealPhone` of one of the services. */
  phone?: string
  /** "+994 50 *** ** 34" (public reads, backend-contract.md 3.1) */
  phoneMasked?: string
  kind?: 'company' | 'individual'
}

export interface Service {
  id: string
  slug: string
  title: string
  /** Shorter/alternate title used on the home page service showcase when it differs in Figma */
  homeTitle?: string
  /** Display price, e.g. "25 ₼/m²-dən", "Razılaşma yolu ilə" */
  priceLabel: string
  /** Numeric lower bound in AZN when the design specifies one (for sorting/filtering) */
  priceFrom?: number
  /**
   * How the price is meant and what it buys (backend-contract.md 1.7), so the UI can word the price in any language.
   * Until it does, `priceLabel` is the ready text.
   */
  priceType?: PriceType
  priceUnit?: PriceUnit
  providerId: string
  /** Service areas, e.g. ["Bakı", "Abşeron"] */
  areas: string[]
  categoryId: string
  cover: string
  images: string[]
  description?: string[]
  /** "✓ ..." checklist on the service detail page */
  includes?: string[]
  /** e.g. "Elan № 20316" */
  number?: number
  verified: boolean
}

export interface UserProfile {
  id: string
  fullName: string
  /** "" when the account has none */
  email: string
  /** "+994 50 555 12 34" (the API's E.164 is shown in the site's spacing) */
  phone: string
  accountType: SellerType
  /** The business profile («mağaza») of a business account */
  sellerId?: string
  /** Who may open /idareetme (backend-contract.md 2.1) */
  role: UserRole
  /** The language of SMS and e-mail (backend-contract.md 2.1) */
  locale: Locale
}

/** backend-contract.md 2.1. */
export type UserRole = 'user' | 'moderator' | 'admin'

/** The site's languages; ru and en come with the translations. */
export type Locale = 'az' | 'ru' | 'en'

/** Why a sign-in was refused (backend-contract.md 2.1). `locked`: too many wrong passwords, try later or by SMS code. */
export type LoginError = 'wrong-credentials' | 'locked' | 'blocked'

/** Sign-in and registration (backend-contract.md 2.1): the account is signed in at once. */
export type LoginResult = { ok: true; user: UserProfile } | { ok: false; error: LoginError; retryAfterSec?: number }

/** `PATCH /me`: what is sent changes; `email: ""` removes the e-mail. */
export interface ProfilePatch {
  fullName?: string
  email?: string
  locale?: Locale
}

/**
 * The signed-in business's own profile, «mağaza» (`GET /me/seller`, backend-contract.md 2.1): the public `Seller` with
 * the business's own `phone` and the `version` to send back with a change.
 */
export interface OwnSeller extends Seller {
  version: string
}

/**
 * `PATCH /me/seller`: what is sent changes, what is not stays; `""` (or `[]`) removes a value. The name, kind and city
 * cannot be removed. The slug (the page's address) stays when the name changes. `version`: refuse the change when the
 * profile changed since it was read.
 */
export interface SellerProfilePatch {
  name?: string
  businessKind?: BusinessKind
  cityId?: string
  contactPerson?: string
  address?: string
  about?: string
  terms?: string
  hours?: OpeningHours[]
  offers?: SellerOffer[]
  phone?: string
  whatsapp?: boolean
  email?: string
  instagram?: string
  website?: string
  responseMinutes?: number
  location?: { lat: number; lng: number }
  version?: string
}

/** «Seçilmişlər» as cards (`GET /me/favorites/items`), in the order they were saved; listings no longer for sale have none. */
export interface FavoriteItems {
  listings: Listing[]
  services: Service[]
}

/* ======================================================================================================== *
 * Plant-world additions (Nov 2026). All of them are additive and optional: existing fields keep their      *
 * meaning. Backend notes with example payloads: docs/handoff/contract-additions.md (for Ruslan).           *
 * ======================================================================================================== */

/** How the price is meant: a fixed price, a price open to bargaining, or no price («Razılaşma yolu ilə»). */
export type PriceType = 'fixed' | 'negotiable' | 'agreement'

/** What one price buys (`hour` and `job` are for services). Display names: features/listing/facts.ts. */
export type PriceUnit = 'piece' | 'kg' | 'litre' | 'sqm' | 'bag' | 'set' | 'metre' | 'hour' | 'job'

/** Wholesale («topdan») price per unit from a minimum quantity. */
export interface WholesalePrice {
  price: number
  minQuantity: number
}

/** «Dibçəkdə» (container), «Torpaq kürəsi ilə» (root ball), «Açıq kök» (bare root). */
export type RootSystem = 'container' | 'rootball' | 'bare-root'
export type SunNeed = 'full-sun' | 'part-shade' | 'shade'
export type WaterNeed = 'low' | 'medium' | 'high'
export type Foliage = 'evergreen' | 'deciduous'

/** Facts about a living plant, shown as the attributes table and the care block of a listing. */
export interface PlantFacts {
  /** Latin name, e.g. "Olea europaea" */
  species?: string
  /** Height in cm; `max` omitted for one value */
  heightCm?: { min: number; max?: number }
  ageYears?: number
  rootSystem?: RootSystem
  /** Container size in litres (when `rootSystem` is "container") */
  potLitres?: number
  sun?: SunNeed
  water?: WaterNeed
  /** Lowest winter temperature the plant survives, °C (e.g. -12) */
  frostHardinessC?: number
  foliage?: Foliage
  /** Best planting months, 1–12 */
  plantingMonths?: number[]
}

export type PromotionPackageId = 'one-cixar' | 'ireli-cek' | 'paket'

/** A paid promotion running on a listing. */
export interface ListingPromotion {
  packageId: PromotionPackageId
  /** ISO date the promotion ends */
  until: string
}

/** Owner-only numbers for one listing («Elanlarım»). */
export interface ListingStats {
  views: number
  phoneReveals: number
  favourites: number
  /** Last 14 days, oldest first */
  viewsByDay: Array<{ date: string; views: number }>
}

/** Optional listing fields added for the plant world (declaration merging keeps the original block untouched). */
export interface Listing {
  /** ISO date of the last edit or renewal («Yeniləndi») */
  updatedAt?: string
  /** ISO date the listing stops being public unless renewed */
  expiresAt?: string
  /** ISO date of the last «İrəli çək» (sorts with `publishedAt` in «Ən yenilər») */
  bumpedAt?: string
  priceType?: PriceType
  priceUnit?: PriceUnit
  wholesale?: WholesalePrice
  /** Units in stock, when the seller states it */
  quantityAvailable?: number
  /** Village / district / street, shown after the city */
  area?: string
  plant?: PlantFacts
  /** The seller's own care tips, one per item */
  careTips?: string[]
  /** «Əkin xidməti var»: the seller can plant it on site */
  plantingAvailable?: boolean
  /** Where the seller delivers, e.g. "Bakı və Abşeron" */
  deliveryAreas?: string
  /** Contact for listings without a seller profile (individuals) */
  contactName?: string
  /**
   * The listing's number. Never in public reads (backend-contract.md 3.1, decision 4): pages get `phoneMasked` and
   * the number itself only from `revealPhone` after «Nömrəni göstər». The owner's own listings and admin data keep it.
   */
  contactPhone?: string
  /** "+994 50 *** ** 34": the listing has a callable number (not sent when `phoneHidden`) */
  phoneMasked?: string
  /** The phone number also takes WhatsApp messages */
  whatsapp?: boolean
  /** The seller asked to hide the number: buyers write on WhatsApp only */
  phoneHidden?: boolean
  promotion?: ListingPromotion
  /** Moderator's reason as text, for status "rejected" (the demo data; the API sends `OwnListing.rejectionReasonCode`) */
  rejectionReason?: string
  /** Owner-only statistics (never sent on public endpoints) */
  stats?: ListingStats
}

/** «Tingçilik təsərrüfatı», «Bağ mərkəzi», «Landşaft şirkəti». `Seller.kind` keeps the display text. */
export type BusinessKind = 'nursery' | 'garden-centre' | 'landscaping'

/** What a business offers besides selling («Çatdırılma», «Əkin», …). */
export type SellerOffer = 'delivery' | 'planting' | 'design' | 'wholesale' | 'care'

/** Opening hours for one weekday (1 = Monday … 7 = Sunday); `closed` days have no times. */
export interface OpeningHours {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7
  open?: string
  close?: string
  closed?: boolean
}

/** Optional seller fields added for business profiles (nurseries, garden centres, landscaping companies). */
export interface Seller {
  businessKind?: BusinessKind
  /** Square logo (path under /public) */
  logo?: string
  hours?: OpeningHours[]
  whatsapp?: boolean
  instagram?: string
  website?: string
  /** Map pin of the address */
  location?: { lat: number; lng: number }
  offers?: SellerOffer[]
  /** Typical reply time in minutes («Adətən 1 saat ərzində cavab verir») */
  responseMinutes?: number
  /** Services this business publishes on /xidmetler */
  serviceIds?: string[]
}

/* ---------- Promotion ---------- */

export interface PromotionOption {
  id: string
  /** "7 gün", "1 dəfə" */
  label: string
  price: number
  /** How long it runs */
  days?: number
  /** «İrəli çək»: how many times the listing is lifted */
  bumps?: number
}

export interface PromotionPackage {
  id: PromotionPackageId
  name: string
  summary: string
  benefits: string[]
  options: PromotionOption[]
}

export interface PromotionOrder {
  id: string
  listingId: string
  packageId: PromotionPackageId
  optionId: string
  amount: number
  /** The mock pays at once; a real payment returns "pending" until the provider confirms */
  status: 'paid' | 'pending' | 'failed'
  createdAt: string
}

/* ---------- Posting ---------- */

/** What «Elan yerləşdir» sends. Photos are uploaded first; `photoIds` keep the gallery order, cover first. */
export interface ListingInput {
  kind: CategoryKind
  categoryId: string
  /** The sub-category's (a service's type's) name, as the wizard keeps it */
  subcategory?: string
  /**
   * The sub-category's id (backend-contract.md 1.3): decides over `subcategory`, so a renamed sub-category still takes
   * new listings.
   */
  subcategoryId?: string
  title: string
  description: string
  /** Category attributes from the posting form, keyed by attribute id (see features/posting/attributes.ts) */
  attributes: Record<string, string>
  plant?: PlantFacts
  priceType: PriceType
  price?: number
  priceUnit?: PriceUnit
  wholesale?: WholesalePrice
  quantityAvailable?: number
  cityId: string
  area?: string
  deliveryAvailable: boolean
  deliveryAreas?: string
  plantingAvailable: boolean
  contactName: string
  contactPhone: string
  whatsapp: boolean
  phoneHidden: boolean
  photoIds: string[]
  /** Promotion chosen while posting; paid after moderation approves the listing */
  promotion?: { packageId: PromotionPackageId; optionId: string }
}

export interface ListingSubmitResult {
  id: string
  slug: string
  number: number
  status: 'pending'
}

/* ---------- The owner's listings («Elanlarım», backend-contract.md 2.2, 3.3) ---------- */

/** Why a moderator refused a listing (backend-contract.md 3.5). The UI words it in its language (features/cabinet/rejection.ts). */
export type RejectionReasonCode = 'wrong-category' | 'wrong-price' | 'unverified-contact' | 'bad-photos' | 'duplicate' | 'other'

/**
 * One of the signed-in owner's listings, any status but deleted (`GET /me/listings`, `GET /me/listings/{id}`): the
 * public `Listing` with the owner's own fields (`contactPhone` too). Moderators see listings in this shape as well.
 */
export interface OwnListing extends Listing {
  kind: CategoryKind
  /** The number is the account's own (SMS-verified) one */
  contactPhoneVerified: boolean
  /** Only for status `rejected` */
  rejectionReasonCode?: RejectionReasonCode
  /** The moderator's own words, only for status `rejected` */
  rejectionNote?: string
  /** ISO time it last went to the moderator */
  submittedAt?: string
  /** The row's version: sent back with an edit (an older one answers 409 `concurrency-conflict`) */
  version: string
  /** The photos' ids in gallery order (the same order as `images`): an edit keeps them without uploading again */
  photoIds: string[]
}

/* ---------- Photo upload (backend-contract.md 3.2) ---------- */

/** What the site's server asks for before the browser sends a photo. */
export interface PhotoUploadRequest {
  fileName: string
  /** `image/jpeg`, `image/png` or `image/webp` */
  contentType: string
  bytes: number
}

/** Where the browser sends the file (`PUT uploadUrl`, one use, 10 minutes); `photoId` goes into `ListingInput.photoIds`. */
export interface PhotoUpload {
  photoId: string
  uploadUrl: string
  expiresAt: string
}

/** The answer of the `PUT`: the photo is processed and ready to attach. */
export interface UploadedPhoto {
  photoId: string
  status: 'ready'
  width: number
  height: number
  url: string
}

/* ---------- Moderation (backend-contract.md 3.5, AdminRepository) ---------- */

/** `approved`: on the site, or was (active, expired, deactivated). */
export type ModerationStatus = 'pending' | 'approved' | 'rejected'

/** `new`: the listing's first version; `recheck`: a later one (an edit, a fix after a rejection). */
export type ModerationKind = 'new' | 'recheck'

export type ModerationSort = 'newest' | 'oldest'

export interface ModerationQuery {
  status?: ModerationStatus
  kind?: ModerationKind
  sort?: ModerationSort
  /** A listing number or words of the title */
  q?: string
  page: number
  pageSize?: number
}

/** The account behind a queue item. */
export interface ModerationSeller {
  userId: string
  sellerId?: string
  name: string
  accountType: SellerType
  verified: boolean
  /** The business's active listings; 0 for an individual */
  activeListings: number
  memberSince?: number
}

/** One field that changed since the last approved version (`ListingInput` paths: `price`, `plant.heightCm`, `photos`, …). */
export interface ModerationChange {
  field: string
  before?: string
  after?: string
}

export interface ModerationDecisionRecord {
  decision: 'approve' | 'reject'
  reasonCode?: RejectionReasonCode
  note?: string
  createdAt: string
}

/** A listing in the moderation queue, with what the review panel needs (the UI words it). */
export interface ModerationItem {
  /** The listing's id */
  id: string
  listingId: string
  number: number
  title: string
  sellerName: string
  submittedAt: string
  categoryId: string
  kind: ModerationKind
  status: ModerationStatus
  /** The version sent last (1, 2, …) */
  revision: number
  /** Sent back with the decision */
  version: string
  /** `false`: «Əlaqə nömrəsi təsdiqlənməyib» */
  contactPhoneVerified: boolean
  photoCount: number
  seller: ModerationSeller
  /** The listing as its owner sees it, the number included */
  listing: OwnListing
  /** Empty for a first version */
  changes: ModerationChange[]
  lastDecision?: ModerationDecisionRecord
}

/** A queue page with the header's and the chips' totals. */
export interface ModerationQueue {
  items: ModerationItem[]
  total: number
  page: number
  pageCount: number
  totals: { pending: number; recheck: number; approved: number; rejected: number }
}

/** A moderator's decision; `version` is the item's, so a listing changed meanwhile is not decided blind. */
export interface ModerationDecisionInput {
  decision: 'approve' | 'reject'
  reasonCode?: RejectionReasonCode
  /** Required for `other`; at most 500 characters */
  note?: string
  version: string
}

export interface ModerationDecisionResult {
  listingId: string
  decision: 'approve' | 'reject'
  status: ListingStatus
  version: string
}

/* ---------- Reports, the admin home and categories for the staff (backend-contract.md 3.5, 4.1) ---------- */

/** A report's state: «Açıq», «Araşdırılır», «Həll olunub». */
export type ComplaintStatus = 'open' | 'investigating' | 'resolved'

/** How a resolved report ended: «Tədbir görüldü» or «Pozuntu yoxdur». */
export type ReportResolution = 'action-taken' | 'no-violation'

/** An account an admin answer names: the reporter, the staff member who handled it. */
export interface StaffRef {
  userId: string
  name: string
}

/** An account's state; a blocked one cannot sign in and has no listings on the site. */
export type AccountStatus = 'active' | 'blocked' | 'deleted'

/** The account behind a reported listing, service or seller: what blocking it needs. */
export interface ReportOwner {
  userId: string
  name: string
  accountType: SellerType
  status: AccountStatus
}

/** A reported seller. */
export interface ReportSeller {
  id: string
  slug: string
  name: string
  verified: boolean
}

/** One staff change of a report («Qərar tarixçəsi»), oldest first. */
export interface ReportHistoryEntry {
  status: ComplaintStatus
  resolution?: ReportResolution
  /** «Moderator qeydi» */
  note?: string
  at: string
  by?: StaffRef
}

/**
 * A report as the staff see it (`GET /admin/reports`): codes, not ready texts (the UI words them). The target is a
 * listing or a service as its owner sees it (the number included), or a seller.
 */
export interface ReportItem {
  id: string
  target: ReportTarget
  /** The listing's, service's or seller's id */
  targetId: string
  reason: ReportReason
  /** The reporter's own words */
  comment?: string
  status: ComplaintStatus
  /** Only when `resolved` */
  resolution?: ReportResolution
  createdAt: string
  handledAt?: string
  handledBy?: StaffRef
  /** A signed-in reporter; a guest has none */
  reporter?: StaffRef
  owner?: ReportOwner
  listing?: OwnListing
  seller?: ReportSeller
  /** The listing was deleted after the report */
  targetDeleted: boolean
  /** The target's unresolved reports, this one included */
  openReportsOnTarget: number
  /** The latest note of the history */
  note?: string
  history: ReportHistoryEntry[]
}

/** Reports by status: the chips and the header («7 açıq şikayət · 2 araşdırılır · 18 həll olunub»). */
export interface ReportTotals {
  open: number
  investigating: number
  resolved: number
}

/** A page of reports with every report's totals. */
export interface ReportQueue {
  items: ReportItem[]
  total: number
  page: number
  pageCount: number
  totals: ReportTotals
}

export interface ReportQuery {
  /** Every status when not given */
  status?: ComplaintStatus
  target?: ReportTarget
  reason?: ReportReason
  sort?: ModerationSort
  page: number
  pageSize?: number
}

/** A staff change of a report: resolving needs a `resolution`; the note goes into the history. */
export interface ReportUpdate {
  status?: ComplaintStatus
  resolution?: ReportResolution
  /** At most 500 characters */
  note?: string
}

/** The admin home's numbers (`GET /admin/overview`). Deleted listings and accounts are not counted. */
export interface AdminOverview {
  /** The moderation queue's totals, as `ModerationQueue.totals` */
  moderation: { pending: number; recheck: number; approved: number; rejected: number }
  reports: ReportTotals
  listings: { active: number; pending: number; rejected: number; expired: number; inactive: number }
  /** `staff`: moderators and admins; `newThisWeek`: the last 7 days */
  users: { total: number; individual: number; business: number; blocked: number; staff: number; newThisWeek: number }
  sellers: { total: number; verified: number }
  /** «Usta çağır»; `unrouted`: no provider got the request */
  serviceRequests: { total: number; thisWeek: number; unrouted: number }
  support: { new: number; answered: number; closed: number }
  categories: { total: number; active: number; subcategories: number }
}

/** A text in the site's languages; `az` is the one every other falls back to (backend-contract.md, «dil»). */
export interface LocalizedText {
  az: string
  ru?: string
  en?: string
}

/** The «Elan yerləşdir» attribute set a category uses (features/posting/attributes.ts). */
export type CategoryForm = 'plant' | 'pack' | 'goods' | 'grass' | 'service'

/** One catalogue filter of a category, on or off (ids: `species`, `height`, `age`, `rootSystem`, `serviceType`, …). */
export interface CategoryFilterSetting {
  id: string
  enabled: boolean
}

/**
 * A category or sub-category as the admin edits it (`GET /admin/categories`): names in every language, inactive ones
 * too. A category lists its sub-categories; a sub-category has `parentId` and no form, icon or filters.
 */
export interface AdminCategory {
  id: string
  parentId?: string
  kind: CategoryKind
  form?: CategoryForm
  names: LocalizedText
  descriptions?: LocalizedText
  icon?: IconName
  filters: CategoryFilterSetting[]
  sortOrder: number
  isActive: boolean
  /** Active listings; a category's count includes its sub-categories' */
  listingCount: number
  /** Sent back with a change */
  version: string
  createdAt: string
  updatedAt: string
  subcategories?: AdminCategory[]
}

/** A new category, or with `parentId` a sub-category (which takes its parent's kind and has no form, icon or filters). */
export interface AdminCategoryInput {
  /** Made from the Azerbaijani name when not given */
  id?: string
  parentId?: string
  kind?: CategoryKind
  form?: CategoryForm
  names: LocalizedText
  descriptions?: LocalizedText
  icon?: IconName
  filters?: CategoryFilterSetting[]
  sortOrder?: number
  isActive?: boolean
}

/** A change of a category: what is sent changes; `descriptions: null` removes them. */
export interface AdminCategoryPatch {
  names?: LocalizedText
  descriptions?: LocalizedText | null
  icon?: IconName
  filters?: CategoryFilterSetting[]
  sortOrder?: number
  isActive?: boolean
  /** `AdminCategory.version` as read: a stale one is refused */
  version?: string
}

/** «Təsdiqlənmiş satıcı» after `verifySeller`. */
export interface SellerVerification {
  sellerId: string
  verified: boolean
  verifiedAt?: string
}

/** An account after `blockUser`: the sessions it ended and the listings it took off (or put back on) the site. */
export interface BlockResult {
  userId: string
  status: AccountStatus
  sessionsRevoked: number
  listingsHidden: number
  listingsRestored: number
}

/* ---------- «Nömrəni göstər» ---------- */

/**
 * What «Nömrəni göstər» returns (backend-contract.md 3.1): the number, and a WhatsApp chat link when the number takes
 * messages. A listing whose seller hid the number gets the WhatsApp link only; neither when there is no way to reach
 * the seller.
 */
export interface ContactReveal {
  phone?: string
  /** https://wa.me/<digits> */
  whatsappUrl?: string
}

/* ---------- Phone verification (SMS code) ---------- */

export type OtpPurpose = 'register' | 'login' | 'reset-password' | 'change-phone'

export interface OtpChallenge {
  challengeId: string
  /** "+994 50 *** ** 34" */
  phoneMasked: string
  expiresInSec: number
  /** Seconds before «Kodu yenidən göndər» is allowed */
  resendInSec: number
  /** DEMO ONLY: the mock returns the code so the flow can be tried without SMS. Never set by a real API. */
  demoCode?: string
}

export interface OtpVerifyResult {
  ok: boolean
  error?: 'wrong-code' | 'expired' | 'too-many-attempts'
  attemptsLeft?: number
}

/* ---------- Accounts ---------- */

export interface RegistrationInput {
  accountType: SellerType
  businessKind?: BusinessKind
  companyName?: string
  fullName: string
  phone: string
  email?: string
  password: string
  /** Proof that the phone was verified (OtpChallenge.challengeId after a successful verifyOtp) */
  otpChallengeId: string
}

/* ---------- Reports, service requests, saved searches ---------- */

export type ReportTarget = 'listing' | 'seller' | 'service'

/**
 * Why something is reported (backend-contract.md 4.1): a code, the UI words it (features/seller/complaintReasons.ts).
 * Each target offers its own codes; `other` needs a comment.
 */
export type ReportReason =
  | 'sold'
  | 'wrong-price'
  | 'wrong-photos'
  | 'wrong-info'
  | 'unreachable'
  | 'duplicate'
  | 'fraud'
  | 'misconduct'
  | 'not-provided'
  | 'stolen-photos'
  | 'other'

export interface ReportInput {
  target: ReportTarget
  targetId: string
  reason: ReportReason
  /** Required for `other`; at most 500 characters */
  comment?: string
}

/** «Usta çağır»: a request sent to a service provider (or to all providers of a category when none is chosen). */
export interface ServiceRequestInput {
  serviceId?: string
  providerId?: string
  categoryId: string
  cityId: string
  area?: string
  /** ISO date the customer prefers */
  preferredDate?: string
  /** Rough size of the job, e.g. "120 m²" */
  size?: string
  description: string
  name: string
  phone: string
}

export interface ServiceRequestResult {
  id: string
  /** "Sorğu № 3021" */
  number: number
}

/** A «Usta çağır» request that came to the signed-in provider («Gələn sorğular», backend-contract.md 4.2). */
export interface IncomingServiceRequest {
  id: string
  number: number
  /** The service type */
  categoryId: string
  /** Its name */
  category: string
  cityId: string
  city: string
  area?: string
  /** `YYYY-MM-DD` */
  preferredDate?: string
  size?: string
  description: string
  customerName: string
  /** The customer's number to call back ("+994 55 700 11 22"; the API's E.164 in the site's spacing) */
  customerPhone: string
  createdAt: string
  /** Not sent while the provider has not opened it */
  seenAt?: string
  /** When the SMS notice went out */
  notifiedAt?: string
  /** How many providers got it: 1 when the customer chose this one */
  recipientCount: number
  /** The service whose page it came from */
  service?: { id: string; slug: string; title: string }
}

/** A page of the provider's requests, newest first, with how many are not opened yet. */
export interface IncomingServiceRequestPage {
  items: IncomingServiceRequest[]
  total: number
  page: number
  pageCount: number
  unseen: number
}

/** «Axtarışı yadda saxla»: a named catalogue search with optional alerts about new matches. */
export interface SavedSearch {
  id: string
  name: string
  /** The catalogue query string, e.g. "kateqoriya=agaclar&seher=baki" */
  query: string
  alerts: boolean
  createdAt: string
  /** New matches since the user last opened it (computed by the API) */
  newCount?: number
}

/** «Axtarışı yadda saxla» (backend-contract.md 2.3); saving the same filters again updates that search. */
export interface SavedSearchInput {
  name: string
  query: string
  alerts: boolean
}

/** «Bizimlə əlaqə» form (support). `contact` is a phone or an e-mail. */
export interface SupportMessageInput {
  topic: 'listing' | 'account' | 'payment' | 'complaint' | 'other'
  name: string
  contact: string
  message: string
  /** «Elan №», when the question is about a listing */
  listingNumber?: number
}
