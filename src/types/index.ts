/**
 * Domain types for the GreenStore marketplace.
 * Shapes are intentionally close to what an ASP.NET Core Web API would return (camelCase JSON DTOs),
 * so the mock data modules in `src/data` can later be swapped for HTTP calls in `src/services`.
 */

/** Lucide icon names used by the Figma design (e.g. category cards). */
export type IconName =
  | 'trees'
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

export type ListingStatus = 'active' | 'pending' | 'rejected' | 'expired' | 'inactive'

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
  /** Promoted ("VIP") listing */
  vip: boolean
  categoryId: string
  /** e.g. "Dekorativ ağaclar" (detail page breadcrumb/specs) */
  subcategory?: string
  sellerId?: string
  /** Image used on listing cards (path under /public) */
  cover: string
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
