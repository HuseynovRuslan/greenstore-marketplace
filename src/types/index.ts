/**
 * Domain types for the GreenStore marketplace.
 * Shapes are intentionally close to what an ASP.NET Core Web API would return (camelCase JSON DTOs),
 * so the mock data modules in `src/data` can later be swapped for HTTP calls in `src/services`.
 */

/** Lucide icon names used by the Figma design (e.g. category cards). `shrub` was added for "Kollar" (Variant 2). */
export type IconName =
  | 'trees'
  | 'shrub'
  | 'flower-2'
  | 'flower'
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
  /** e.g. "Dekorativ ağaclar" (detail page breadcrumb/specs) */
  subcategory?: string
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
  phone?: string
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
  phone?: string
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
  email: string
  phone: string
  accountType: SellerType
  sellerId?: string
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
  contactPhone?: string
  /** The phone number also takes WhatsApp messages */
  whatsapp?: boolean
  /** The seller asked to hide the number: buyers write on WhatsApp only */
  phoneHidden?: boolean
  promotion?: ListingPromotion
  /** Moderator's reason, for status "rejected" */
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
  subcategory?: string
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

export interface ReportInput {
  target: ReportTarget
  targetId: string
  reason: string
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

/** «Bizimlə əlaqə» form (support). `contact` is a phone or an e-mail. */
export interface SupportMessageInput {
  topic: 'listing' | 'account' | 'payment' | 'complaint' | 'other'
  name: string
  contact: string
  message: string
  /** «Elan №», when the question is about a listing */
  listingNumber?: number
}
