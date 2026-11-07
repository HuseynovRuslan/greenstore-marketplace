import { serviceCategories } from '@/data/services'
import { normalizeSearch } from '@/lib/format'
import { phoneValue } from '@/lib/phone'
import type { CategoryKind, Listing, ListingInput, PriceType, PriceUnit, PromotionPackageId } from '@/types'
import { attributeLine, parseNumberValue, plantFacts, SERVICE_CATEGORY, unitsFor } from './attributes'

/*
 * «Elan yerləşdir» draft (v2, Nov 2026): one plain object, autosaved to localStorage on every change. Photos are
 * listed here by id; their image data lives in IndexedDB (photoStore.ts). Pure helpers turn the draft into the
 * contract's ListingInput and into a Listing for the preview and the cabinet.
 */

export const STEPS = [
  { n: 1, slug: 'kateqoriya', title: 'Kateqoriya', heading: 'Nə yerləşdirirsiniz?' },
  { n: 2, slug: 'melumat', title: 'Məlumat', heading: 'Bitki və ya məhsul haqqında' },
  { n: 3, slug: 'sekiller', title: 'Şəkillər', heading: 'Şəkillər' },
  { n: 4, slug: 'qiymet', title: 'Qiymət və ünvan', heading: 'Qiymət və ünvan' },
  { n: 5, slug: 'elaqe', title: 'Əlaqə', heading: 'Alıcılar sizinlə necə əlaqə saxlasın?' },
  { n: 6, slug: 'yoxla', title: 'Yoxla və göndər', heading: 'Elan belə görünəcək' },
] as const

export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6
export const STEP_COUNT = STEPS.length

export const TITLE_MIN = 5
export const TITLE_MAX = 80
export const DESCRIPTION_MIN = 20
export const DESCRIPTION_MAX = 3000
export const MAX_PHOTOS = 12
export const MAX_PHOTO_MB = 10

export interface DraftPhoto {
  id: string
  name: string
  width: number
  height: number
}

export interface PostingDraft {
  version: 2
  kind: CategoryKind | ''
  categoryId: string
  /** Sub-category name (products) or the service type name (services) */
  subcategory: string
  title: string
  description: string
  /** Category attribute values by attribute id (attributes.ts); ranges use `<id>Min` / `<id>Max` */
  attrs: Record<string, string>
  /** Gallery order; the first photo is the cover */
  photos: DraftPhoto[]
  priceType: PriceType
  price: string
  priceUnit: PriceUnit | ''
  wholesale: boolean
  wholesalePrice: string
  wholesaleMin: string
  quantity: string
  cityId: string
  area: string
  delivery: boolean
  deliveryAreas: string
  planting: boolean
  contactName: string
  phone: string
  whatsapp: boolean
  hidePhone: boolean
  promotion: { packageId: PromotionPackageId; optionId: string } | null
  rulesAccepted: boolean
  /** Furthest step opened with «Davam et»; deep links past it go back there */
  reachedStep: StepNumber
  /** ISO time of the last change («Qaralama saxlanıldı · 14:32») */
  savedAt: string
  /** Set when the draft edits a published listing («Redaktə et»): the category is locked and the number kept */
  editing?: { id: string; number?: number; slug: string }
}

export function createDraft(contact?: { name?: string; phone?: string }): PostingDraft {
  return {
    version: 2,
    kind: '',
    categoryId: '',
    subcategory: '',
    title: '',
    description: '',
    attrs: {},
    photos: [],
    priceType: 'fixed',
    price: '',
    priceUnit: '',
    wholesale: false,
    wholesalePrice: '',
    wholesaleMin: '',
    quantity: '',
    cityId: '',
    area: '',
    delivery: false,
    deliveryAreas: '',
    planting: false,
    contactName: contact?.name ?? '',
    phone: contact?.phone ? phoneValue(contact.phone) : '',
    whatsapp: true,
    hidePhone: false,
    promotion: null,
    rulesAccepted: false,
    reachedStep: 1,
    savedAt: '',
  }
}

/** A stored draft read back: unknown or broken data starts a clean draft, missing fields get their defaults. */
export function restoreDraft(raw: unknown, contact?: { name?: string; phone?: string }): PostingDraft {
  const base = createDraft(contact)
  if (!raw || typeof raw !== 'object' || (raw as { version?: unknown }).version !== 2) return base
  const d = { ...base, ...(raw as Partial<PostingDraft>) }
  return {
    ...d,
    attrs: d.attrs && typeof d.attrs === 'object' ? d.attrs : {},
    photos: Array.isArray(d.photos) ? d.photos.filter((p) => p && typeof p.id === 'string').slice(0, MAX_PHOTOS) : [],
    reachedStep: ([1, 2, 3, 4, 5, 6] as const).includes(d.reachedStep) ? d.reachedStep : 1,
  }
}

/** Has the seller entered anything yet? (The resume note and «Yenidən başla» only make sense then.) */
export function hasProgress(d: PostingDraft): boolean {
  return Boolean(d.kind || d.title || d.photos.length || d.price)
}

/** Choosing another category resets what depends on it: sub-category, attributes, the unit. */
export function withCategory(d: PostingDraft, kind: CategoryKind, categoryId: string): PostingDraft {
  if (d.kind === kind && d.categoryId === categoryId) return d
  return { ...d, kind, categoryId, subcategory: '', attrs: {}, priceUnit: unitsFor(categoryId)[0] ?? '' }
}

/** Service types («Landşaft dizaynı», …) for the service category. */
export const serviceTypes = serviceCategories.map((c) => c.name)

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

const amount = (value: string) => parseNumberValue(value)

/** What «Elan yerləşdir» sends (`photoIds` are the uploaded photo ids, cover first). */
export function toListingInput(d: PostingDraft): ListingInput {
  const priced = d.priceType !== 'agreement'
  const digits = d.phone.replace(/\D/g, '')
  return {
    kind: d.kind || 'product',
    categoryId: d.categoryId,
    subcategory: d.subcategory || undefined,
    title: d.title.trim(),
    description: d.description.trim(),
    attributes: Object.fromEntries(Object.entries(d.attrs).filter(([, v]) => v.trim() !== '')),
    plant: plantFacts(d.categoryId, d.attrs),
    priceType: d.priceType,
    price: priced ? amount(d.price) : undefined,
    priceUnit: priced && d.priceUnit ? d.priceUnit : undefined,
    wholesale: priced && d.wholesale ? { price: amount(d.wholesalePrice) ?? 0, minQuantity: amount(d.wholesaleMin) ?? 0 } : undefined,
    quantityAvailable: amount(d.quantity),
    cityId: d.cityId,
    area: d.area.trim() || undefined,
    deliveryAvailable: d.delivery,
    deliveryAreas: d.delivery ? d.deliveryAreas.trim() || undefined : undefined,
    plantingAvailable: d.planting,
    contactName: d.contactName.trim(),
    contactPhone: digits ? `+${digits}` : '',
    whatsapp: d.whatsapp,
    phoneHidden: d.hidePhone,
    photoIds: d.photos.map((p) => p.id),
    promotion: d.promotion ?? undefined,
  }
}

function slugify(value: string) {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface ListingOptions {
  /** Photo URLs in gallery order */
  images: string[]
  now: Date
  number?: number
  sellerId?: string
  status?: Listing['status']
}

/** The Listing the preview renders, and (with a number) the copy kept in «Elanlarım» after sending. */
export function toListing(d: PostingDraft, { images, now, number, sellerId, status = 'pending' }: ListingOptions): Listing {
  const input = toListingInput(d)
  const id = number ? `elan-${number}` : 'onizleme'
  return {
    id,
    slug: number ? `${slugify(input.title) || 'elan'}-${number}` : 'onizleme',
    number,
    title: input.title || 'Elanın başlığı',
    price: input.price ?? 0,
    priceType: input.priceType,
    priceUnit: input.priceUnit,
    wholesale: input.wholesale,
    quantityAvailable: input.quantityAvailable,
    attributes: attributeLine(d.categoryId, d.attrs),
    cityId: input.cityId,
    area: input.area,
    publishedAt: now.toISOString(),
    vip: false,
    categoryId: d.kind === 'service' ? SERVICE_CATEGORY : d.categoryId,
    subcategory: d.subcategory || undefined,
    sellerId,
    cover: images[0] ?? '',
    images,
    description: paragraphs(input.description),
    deliveryAvailable: input.deliveryAvailable,
    deliveryAreas: input.deliveryAreas,
    plantingAvailable: input.plantingAvailable,
    plant: input.plant,
    contactName: input.contactName,
    contactPhone: input.contactPhone || undefined,
    whatsapp: input.whatsapp,
    phoneHidden: input.phoneHidden,
    status,
    views: 0,
  }
}
