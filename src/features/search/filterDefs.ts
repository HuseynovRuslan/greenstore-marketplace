/**
 * Filter model shared by the home hero search (features/home/heroSearch.ts) and the product catalogue
 * (/elanlar, /kateqoriyalar/*; features/search/searchState.ts): URL param names, option lists and the labels that
 * chips, pills and the «Filtrlər» sheet show. A search started on the home page therefore reads the same on the
 * results page («1–2 m», «50 ₼-a qədər»).
 *
 * The catalogue state itself (`SearchState`) stays in searchState.ts: the repository contract uses it.
 */
import { formatNumber } from '@/lib/format'

/* ---------- URL params ---------- */

/** Query-string names the catalogue reads (docs/handoff/categories.md). */
export const PARAM = {
  q: 'q',
  category: 'kateqoriya',
  subcategory: 'alt',
  /** One city id; old links may carry a comma list, which still parses. */
  city: 'seher',
  min: 'min',
  max: 'max',
  species: 'nov',
  /** Height range in cm ("100-200", "-100", "300-"). */
  height: 'hundurluk',
  /** Age range in years ("2-5", "5-"). */
  age: 'yas',
  vip: 'vip',
  delivery: 'catdirilma',
  seller: 'saticiNovu',
  sort: 'siralama',
  view: 'gorunus',
  page: 'sehife',
} as const

export interface FilterOption {
  value: string
  label: string
}

/* ---------- Price ---------- */

/** Raw price inputs, digits only ('' = not set). */
export interface PriceRange {
  min: string
  max: string
}

export const pricePresets: Array<PriceRange & { label: string }> = [
  { label: '50 ₼-a qədər', min: '', max: '50' },
  { label: '50–150 ₼', min: '50', max: '150' },
  { label: '150–300 ₼', min: '150', max: '300' },
  { label: '300 ₼-dan çox', min: '300', max: '' },
]

/**
 * "50–150 ₼", "300 ₼-dan çox", "50 ₼-a qədər": presets and typed values read the same way. The suffix follows
 * the word read aloud (manat → manata, manatdan), not the digits.
 */
export function priceValueLabel(min: string, max: string): string | undefined {
  const a = min.trim()
  const b = max.trim()
  const preset = pricePresets.find((p) => p.min === a && p.max === b)
  if (preset) return preset.label
  if (a && b) return `${formatNumber(Number(a))}–${formatNumber(Number(b))} ₼`
  if (a) return `${formatNumber(Number(a))} ₼-dan çox`
  if (b) return `${formatNumber(Number(b))} ₼-a qədər`
  return undefined
}

/** "Qiymət sıfırdan az ola bilməz." is the Figma error copy; the second message is shared with the home search. */
export function priceError({ min, max }: PriceRange): string | undefined {
  const a = min.trim() === '' ? undefined : Number(min)
  const b = max.trim() === '' ? undefined : Number(max)
  if ((a != null && a < 0) || (b != null && b < 0)) return 'Qiymət sıfırdan az ola bilməz.'
  if (a != null && b != null && a > b) return 'Minimum qiymət maksimumdan böyük ola bilməz.'
  return undefined
}

/* ---------- Height / age ranges ---------- */

const RANGE_RE = /^(\d*)-(\d*)$/

/** "100-200" → [100, 200]; "300-" → [300, undefined]; anything else → [undefined, undefined]. */
export function parseRange(value: string): [number | undefined, number | undefined] {
  const m = RANGE_RE.exec(value)
  if (!m) return [undefined, undefined]
  return [m[1] ? Number(m[1]) : undefined, m[2] ? Number(m[2]) : undefined]
}

/** A usable range param: "A-B", "-B" or "A-" (not "-" alone). */
export function isRange(value: string): boolean {
  return RANGE_RE.test(value) && value !== '-'
}

/** Variant 2 presets: ranges in cm (the catalogue's unit), labelled in metres. */
export const heightOptions: FilterOption[] = [
  { value: '-100', label: '1 m-ə qədər' },
  { value: '100-200', label: '1–2 m' },
  { value: '200-300', label: '2–3 m' },
  { value: '300-', label: '3 m-dən uca' },
]

export const ageOptions: FilterOption[] = [
  { value: '1-2', label: '1–2 yaş' },
  { value: '2-5', label: '2–5 yaş' },
  { value: '5-', label: '5 yaşdan yuxarı' },
]

/** A preset label, or e.g. "80–200 sm" / "80 sm-ə qədər" / "200 sm-dən uca" for older links and custom ranges. */
export function heightLabel(value: string): string {
  const preset = heightOptions.find((o) => o.value === value)
  if (preset) return preset.label
  const [from, to] = parseRange(value)
  if (from != null && to != null) return `${from}–${to} sm`
  if (from != null) return `${from} sm-dən uca`
  return `${to} sm-ə qədər`
}

export function ageLabel(value: string): string {
  const preset = ageOptions.find((o) => o.value === value)
  if (preset) return preset.label
  const [from, to] = parseRange(value)
  if (from != null && to != null) return `${from}–${to} yaş`
  if (from != null) return `${from} yaşdan yuxarı`
  return `${to} yaşa qədər`
}

/* ---------- Seller ---------- */

export type SellerTypeParam = '' | 'biznes' | 'ferdi'

export const sellerOptions: Array<{ value: SellerTypeParam; label: string }> = [
  { value: '', label: 'Hamısı' },
  { value: 'biznes', label: 'Biznes' },
  { value: 'ferdi', label: 'Fərdi' },
]

/** Chip label: "Biznes satıcılar" / "Fərdi satıcılar". */
export function sellerChipLabel(value: SellerTypeParam): string | undefined {
  if (value === 'biznes') return 'Biznes satıcılar'
  if (value === 'ferdi') return 'Fərdi satıcılar'
  return undefined
}

/* ---------- Group titles and toggles ---------- */

/** Popover / sheet / sidebar group titles (the home chips use the same words as chip labels). */
export const filterTitles = {
  category: 'Kateqoriya',
  price: 'Qiymət, ₼',
  height: 'Bitkinin hündürlüyü',
  age: 'Yaş',
  species: 'Növ',
  seller: 'Satıcı',
  extra: 'Əlavə',
} as const

export const toggleLabels = {
  delivery: 'Çatdırılma',
  vip: 'Önə çıxanlar',
} as const
