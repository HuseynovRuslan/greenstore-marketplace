import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import { formatNumber, formatPrice, monthName, upperAz } from '@/lib/format'
import type { Foliage, Listing, PlantFacts, PriceUnit, RootSystem, SunNeed, WaterNeed } from '@/types'
import { listingSpecs } from './detail'

/*
 * Display text for the plant-world listing fields (Nov 2026 contract additions): price with unit, wholesale, stock,
 * plant attributes and care. Pure functions, shared by the listing page, the posting preview, cards and the
 * cabinet, so a value reads the same everywhere.
 */

export const priceUnitLabels: Record<PriceUnit, string> = {
  piece: 'ədəd',
  kg: 'kq',
  litre: 'litr',
  sqm: 'm²',
  bag: 'kisə',
  set: 'dəst',
  metre: 'metr',
  hour: 'saat',
  job: 'iş',
}

/** «10 ədəddən», «30 kisədən», «50 kq-dan»: the unit with its ablative suffix (vowel harmony). */
const unitFrom: Record<PriceUnit, string> = {
  piece: 'ədəddən',
  kg: 'kq-dan',
  litre: 'litrdən',
  sqm: 'm²-dən',
  bag: 'kisədən',
  set: 'dəstdən',
  metre: 'metrdən',
  hour: 'saatdan',
  job: 'işdən',
}

export const rootSystemLabels: Record<RootSystem, string> = {
  container: 'Dibçəkdə',
  rootball: 'Torpaq kürəsi ilə',
  'bare-root': 'Açıq kök',
}

export const sunLabels: Record<SunNeed, string> = { 'full-sun': 'Tam günəş', 'part-shade': 'Yarımkölgə', shade: 'Kölgə' }
export const waterLabels: Record<WaterNeed, string> = { low: 'Az', medium: 'Orta', high: 'Bol' }
export const foliageLabels: Record<Foliage, string> = { evergreen: 'Həmişəyaşıl', deciduous: 'Yarpağını tökən' }

const MINUS = '−'
const capitalize = (s: string) => (s ? upperAz(s.charAt(0)) + s.slice(1) : s)

/** True when the listing has no price to show («Razılaşma ilə»). A 0 price is read the same way (follow-ups). */
export function isPriceByAgreement(listing: Pick<Listing, 'price' | 'priceType'>): boolean {
  return listing.priceType === 'agreement' || !listing.price
}

export interface PriceDisplay {
  /** "145 ₼" or «Razılaşma ilə» */
  amount: string
  /** "/ ədəd" */
  unit?: string
  /** «Qiymətdə razılaşmaq olar» */
  note?: string
}

export function listingPrice(listing: Pick<Listing, 'price' | 'priceType' | 'priceUnit'>): PriceDisplay {
  if (isPriceByAgreement(listing)) return { amount: 'Razılaşma ilə' }
  return {
    amount: formatPrice(listing.price),
    unit: listing.priceUnit ? `/ ${priceUnitLabels[listing.priceUnit]}` : undefined,
    note: listing.priceType === 'negotiable' ? 'Qiymətdə razılaşmaq olar' : undefined,
  }
}

/** «130 ₼ / ədəd, 10 ədəddən» */
export function wholesaleLabel(listing: Pick<Listing, 'wholesale' | 'priceUnit'>): string | undefined {
  if (!listing.wholesale) return undefined
  const unit = listing.priceUnit ?? 'piece'
  return `${formatPrice(listing.wholesale.price)} / ${priceUnitLabels[unit]}, ${formatNumber(listing.wholesale.minQuantity)} ${unitFrom[unit]}`
}

/** «40 ədəd» */
export function stockLabel(listing: Pick<Listing, 'quantityAvailable' | 'priceUnit'>): string | undefined {
  if (listing.quantityAvailable == null) return undefined
  return `${formatNumber(listing.quantityAvailable)} ${priceUnitLabels[listing.priceUnit ?? 'piece']}`
}

/** {180, 200} → "180–200 sm"; {120} → "120 sm" */
export function heightLabel(height: NonNullable<PlantFacts['heightCm']>): string {
  return height.max && height.max !== height.min ? `${height.min}–${height.max} sm` : `${height.min} sm`
}

/** −10 → «−10 °C-yə qədər»; a positive value is a plant that needs warmth. */
export function frostLabel(celsius: number): string {
  if (celsius < 0) return `${MINUS}${Math.abs(celsius)} °C-yə qədər`
  return `Şaxtaya dözmür, +${celsius} °C-dən isti saxlayın`
}

/** [3, 4, 5, 9, 10] → «Mart–may, sentyabr–oktyabr» (consecutive months joined into ranges). */
export function monthsLabel(months: number[]): string {
  const sorted = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b)
  const ranges: Array<[number, number]> = []
  for (const m of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && m === last[1] + 1) last[1] = m
    else ranges.push([m, m])
  }
  return capitalize(ranges.map(([a, b]) => (a === b ? monthName(a) : `${monthName(a)}–${monthName(b)}`)).join(', '))
}

export interface FactRow {
  label: string
  value: string
  /** Shown in italics (Latin names) */
  latin?: boolean
}

/**
 * «Xüsusiyyətlər» table: plant facts when the listing has them, otherwise the older specs (Figma) with the
 * category. Category always first.
 */
export function factRows(listing: Listing): FactRow[] {
  const plant = listing.plant
  if (!plant) return listingSpecs(listing).filter((s) => s.label !== 'Satıcı növü')
  const category = categoryById(listing.categoryId)?.name
  const rows: FactRow[] = []
  if (category) rows.push({ label: 'Kateqoriya', value: listing.subcategory ? `${category} / ${listing.subcategory}` : category })
  if (plant.species) rows.push({ label: 'Növ', value: plant.species, latin: true })
  if (plant.heightCm) rows.push({ label: 'Hündürlük', value: heightLabel(plant.heightCm) })
  if (plant.ageYears != null) rows.push({ label: 'Yaş', value: `${plant.ageYears} yaş` })
  if (plant.rootSystem) rows.push({ label: 'Kök sistemi', value: rootSystemLabels[plant.rootSystem] })
  if (plant.potLitres) rows.push({ label: 'Dibçəyin həcmi', value: `${plant.potLitres} litr` })
  if (plant.foliage) rows.push({ label: 'Yarpaq', value: foliageLabels[plant.foliage] })
  const stock = stockLabel(listing)
  if (stock) rows.push({ label: 'Stokda', value: stock })
  return rows
}

export interface CareItem {
  key: 'sun' | 'water' | 'frost' | 'planting'
  label: string
  value: string
}

/** «Qulluq» block: what the plant needs, from its facts. Empty for non-plant listings. */
export function careItems(plant: PlantFacts | undefined): CareItem[] {
  if (!plant) return []
  const items: CareItem[] = []
  if (plant.sun) items.push({ key: 'sun', label: 'İşıq', value: sunLabels[plant.sun] })
  if (plant.water) items.push({ key: 'water', label: 'Suvarma', value: waterLabels[plant.water] })
  if (plant.frostHardinessC != null) items.push({ key: 'frost', label: 'Şaxtaya davamlılıq', value: frostLabel(plant.frostHardinessC) })
  if (plant.plantingMonths?.length) items.push({ key: 'planting', label: 'Əkin vaxtı', value: monthsLabel(plant.plantingMonths) })
  return items
}

/** «Abşeron, Məhəmmədi qəsəbəsi» */
export function placeLabel(listing: Pick<Listing, 'cityId' | 'area'>): string {
  return [cityName(listing.cityId), listing.area].filter(Boolean).join(', ')
}

/** Whole days until `iso` (negative once it has passed). */
export function daysUntil(iso: string, now: number): number {
  return Math.ceil((Date.parse(iso) - now) / 86_400_000)
}
