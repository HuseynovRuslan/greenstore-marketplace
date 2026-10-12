import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import {
  FIRST_LISTING_NUMBER,
  PLANT_CATEGORY_IDS,
  SERVICE_CATEGORY_ID,
  photoVariants,
  type DraftPhoto,
  type PostAdDraft,
} from '@/data/postAd'
import { sellerById } from '@/data/sellers'
import { formatNumber, normalizeSearch } from '@/lib/format'
import type { Listing, Spec, UserProfile } from '@/types'

/* Pure helpers that turn the wizard draft into display strings and, on submit, into a Listing. */

export const isService = (d: PostAdDraft) => d.kind === 'service'
/** Plant-specific fields (type, growing form, height, age, range) only apply to living-plant categories. */
export const isPlant = (d: PostAdDraft) => d.kind === 'product' && PLANT_CATEGORY_IDS.includes(d.categoryId)

export function coverPhoto(d: PostAdDraft): DraftPhoto | undefined {
  return d.photos.find((p) => p.id === d.coverId) ?? d.photos[0]
}

/** Photos with the cover first (listing gallery order). */
export function orderedPhotos(d: PostAdDraft): DraftPhoto[] {
  const cover = coverPhoto(d)
  return cover ? [cover, ...d.photos.filter((p) => p.id !== cover.id)] : []
}

/** "38" → 38, "7,5" → 7.5, "" → undefined, "abc" → NaN */
export function parseNumber(value: string): number | undefined {
  const v = value.trim().replace(/\s/g, '').replace(',', '.').replace('−', '-')
  if (!v) return undefined
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : Number.NaN
}

/** "100–120" / "100-120 sm" → {min, max}; "" → undefined; anything else → 'format' */
export function parseHeightRange(value: string): { min: number; max: number } | 'format' | undefined {
  const v = value.trim()
  if (!v) return undefined
  const m = v.match(/^(\d+)\s*[–—-]\s*(\d+)\s*(sm)?$/i)
  return m ? { min: Number(m[1]), max: Number(m[2]) } : 'format'
}

/** 38 → "38 ₼", 7.5 → "7,50 ₼" */
export function formatAmount(value: number): string {
  return Number.isInteger(value) ? `${formatNumber(value)} ₼` : `${value.toFixed(2).replace('.', ',')} ₼`
}

const validAmount = (d: PostAdDraft) => {
  const n = parseNumber(d.price)
  return n != null && !Number.isNaN(n) && n >= 0 ? n : undefined
}

/** Summary sidebar price: "38 ₼ / ədəd" · services "25 ₼-dən" / "Razılaşma yolu ilə". `gap` widens the slash spacing (step 6 hero). */
export function priceLabel(d: PostAdDraft, gap = ' '): string {
  if (isService(d) && d.servicePriceType === 'agreement') return 'Razılaşma yolu ilə'
  const amount = validAmount(d)
  if (amount == null) return ''
  if (isService(d)) return `${formatAmount(amount)}-dən`
  return d.priceUnit ? `${formatAmount(amount)}${gap}/ ${d.priceUnit}` : formatAmount(amount)
}

export function categoryName(d: PostAdDraft): string {
  if (isService(d)) return categoryById(SERVICE_CATEGORY_ID)?.name ?? ''
  return categoryById(d.categoryId)?.name ?? ''
}

const join = (parts: Array<string | false | undefined>, sep = ' · ') => parts.filter(Boolean).join(sep)
const lower = (s: string) => s.toLocaleLowerCase('az')

/** "Ağaclar · Abşeron · Abşeron Tingçilik" */
export function summaryMeta(d: PostAdDraft): string {
  return join([isService(d) ? d.serviceType || categoryName(d) : categoryName(d), d.cityId && cityName(d.cityId), d.sellerName.trim()])
}

/** "Abşeron, Məhəmmədi · Ağaclar / Dekorativ ağaclar" */
export function previewLocation(d: PostAdDraft): string {
  const place = join([d.cityId && cityName(d.cityId), d.village.trim()], ', ')
  const sub = isService(d) ? d.serviceType : d.subcategory
  return join([place, join([categoryName(d), sub], ' / ')])
}

/** "Leyland sərvi · 120 sm · 2 yaş · dibçəkdə · satışda · çatdırılma: Bakı və Abşeron" */
export function previewAttributes(d: PostAdDraft): string {
  if (isService(d)) return join([d.serviceType, d.serviceArea.trim() && `xidmət ərazisi: ${d.serviceArea.trim()}`])
  const plant = isPlant(d)
  return join([
    plant && d.plantType,
    plant && d.height.trim() && `${d.height.trim()} sm`,
    plant && d.age.trim() && `${d.age.trim()} yaş`,
    plant && d.growingForm && lower(d.growingForm),
    d.availability && lower(d.availability),
    d.delivery && d.deliveryAreas.trim() && `çatdırılma: ${d.deliveryAreas.trim()}`,
  ])
}

/** "Abşeron Tingçilik · Elvin Əliyev · +994 50 555 12 34" */
export function contactLine(d: PostAdDraft): string {
  return join([d.sellerName.trim(), d.contactPerson.trim(), d.phone.trim()])
}

/** Step 6 hero image: Figma's wide render for the example photo, otherwise the cover itself. */
export function previewImage(d: PostAdDraft): string | undefined {
  const cover = coverPhoto(d)
  return cover && (photoVariants[cover.url]?.preview ?? cover.url)
}

/** Confirmation card image: Figma's 220×200 render for the example photo, otherwise the listing cover. */
export function submittedCardImage(listing: Listing): string {
  return photoVariants[listing.cover]?.card ?? listing.cover
}

export function nextListingNumber(existing: Listing[]): number {
  const max = Math.max(FIRST_LISTING_NUMBER - 1, ...existing.map((l) => l.number ?? 0))
  return max + 1
}

/** Local time as an ISO-like string ("2026-10-12T14:05:00") so formatFullDate shows today's local date. */
function localIso(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}:00`
}

function slugify(value: string): string {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Converts a validated draft into the Listing DTO stored by `useMyListings().addListing`. */
export function buildListing(d: PostAdDraft, opts: { number: number; sellerId?: string; now: Date }): Listing {
  const service = isService(d)
  const plant = isPlant(d)
  const amount = validAmount(d) ?? 0
  const photos = orderedPhotos(d).map((p) => p.url)
  const title = d.title.trim()
  const category = categoryName(d)
  const sub = service ? d.serviceType : d.subcategory

  const specs: Spec[] = [
    { label: 'Kateqoriya', value: join([category, sub], ' / ') },
    ...(plant
      ? [
          { label: 'Növ', value: d.plantType },
          { label: 'Hündürlük', value: `${d.height.trim()} sm` },
          { label: 'Yaş', value: `${d.age.trim()} yaş` },
          { label: 'Yetişdirmə forması', value: d.growingForm },
        ]
      : []),
    ...(service ? [{ label: 'Xidmət ərazisi', value: d.serviceArea.trim() }] : [{ label: 'Mövcudluq', value: d.availability }]),
    ...(!service && d.delivery ? [{ label: 'Çatdırılma', value: d.deliveryAreas.trim() }] : []),
    { label: 'Satıcı növü', value: d.sellerKind },
  ].filter((s) => s.value)

  const attributes = service
    ? [d.serviceType, d.serviceArea.trim()]
    : plant
      ? [`${d.height.trim()} sm`, `${d.age.trim()} yaş`, lower(d.growingForm)]
      : [d.subcategory]

  return {
    id: `elan-${opts.number}`,
    slug: `${slugify(title) || 'elan'}-${opts.number}`,
    number: opts.number,
    title,
    price: amount,
    priceNote: service
      ? d.servicePriceType === 'agreement'
        ? 'Razılaşma yolu ilə'
        : 'Başlayan qiymət'
      : join([d.priceUnit && `1 ${d.priceUnit} üçün`, d.negotiable && 'Qiymətdə razılaşmaq olar']),
    attributes: attributes.filter(Boolean),
    cityId: d.cityId,
    publishedAt: localIso(opts.now),
    vip: false,
    categoryId: service ? SERVICE_CATEGORY_ID : d.categoryId,
    subcategory: sub || undefined,
    sellerId: opts.sellerId,
    cover: photos[0] ?? '',
    images: photos,
    description: d.description
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    specs,
    deliveryAvailable: service ? undefined : d.delivery,
    status: 'pending',
    views: 0,
  }
}

/** Contact fields of a fresh draft are pre-filled from the signed-in account. */
export function contactFromUser(user: UserProfile | null) {
  if (!user) return undefined
  return { sellerName: sellerById(user.sellerId)?.name ?? '', contactPerson: user.fullName, phone: user.phone }
}

/** Card price on the confirmation screen: "38 ₼", services "25 ₼-dən" / "Razılaşma yolu ilə". */
export function listingPriceLabel(listing: Listing): string {
  if (listing.categoryId === SERVICE_CATEGORY_ID) {
    if (listing.priceNote === 'Razılaşma yolu ilə') return listing.priceNote
    return `${formatAmount(listing.price)}-dən`
  }
  return formatAmount(listing.price)
}
