import { categoryById, subcategoryById } from '@/data/categories'
import { serviceCategories } from '@/data/services'
import { cityName } from '@/data/cities'
import { ordinal } from '@/features/listing/detail'
import { foliageLabels, listingPrice, placeLabel, priceUnitLabels, rootSystemLabels, sunLabels, waterLabels } from '@/features/listing/facts'
import { formatPrice } from '@/lib/format'
import type { ModerationChange, ModerationItem, ModerationKind, ModerationQuery, ModerationSort, ModerationStatus } from '@/types'

/*
 * DATA_SOURCE=api: /idareetme/moderasiya over the API's queue (backend-contract.md 3.5). The API sends codes and facts,
 * not texts; these pure helpers word them for the review panel, and keep the page's filters in its address
 * (?status=…&kind=…&sort=…&q=…&sehife=…&item=<listingId>; `sehife` as on every page of the site), so a reload or a
 * shared link shows the same queue.
 */

const STATUSES: ModerationStatus[] = ['pending', 'approved', 'rejected']
const KINDS: ModerationKind[] = ['new', 'recheck']
const SORTS: ModerationSort[] = ['newest', 'oldest']
const LISTING_ID_RE = /^[a-z0-9-]{1,80}$/

export interface ModerationPageState {
  status: ModerationStatus
  kind?: ModerationKind
  sort: ModerationSort
  q: string
  page: number
  /** The listing open in the review panel */
  item?: string
  /** The decision just made (the notice after it): which listing, and what */
  done?: { listingId: string; decision: 'approve' | 'reject' }
}

type Params = Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** The page's state from its address; anything unknown falls back to the queue's defaults. */
export function readModerationParams(params: Params): ModerationPageState {
  const pick = <T extends string>(value: string | undefined, allowed: T[]) => (allowed.includes(value as T) ? (value as T) : undefined)
  const page = Number(one(params.sehife))
  const item = one(params.item)
  const doneId = one(params.done)
  const decision = pick(one(params.decision), ['approve', 'reject'])
  return {
    status: pick(one(params.status), STATUSES) ?? 'pending',
    kind: pick(one(params.kind), KINDS),
    sort: pick(one(params.sort), SORTS) ?? 'newest',
    q: (one(params.q) ?? '').trim().slice(0, 100),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    ...(item && LISTING_ID_RE.test(item) ? { item } : {}),
    ...(doneId && LISTING_ID_RE.test(doneId) && decision ? { done: { listingId: doneId, decision } } : {}),
  }
}

export function toModerationQuery(state: ModerationPageState): ModerationQuery {
  return { status: state.status, kind: state.kind, sort: state.sort, q: state.q || undefined, page: state.page }
}

/**
 * The page's address with some of its state changed. Changing a filter starts again at page 1 and closes the review
 * panel; the decision notice is never carried along.
 */
export function moderationHref(state: ModerationPageState, patch: Partial<Omit<ModerationPageState, 'done'>> = {}, basePath = '/idareetme/moderasiya'): string {
  const filterChanged = (['status', 'kind', 'sort', 'q'] as const).some((k) => k in patch && patch[k] !== state[k])
  const next = { ...state, ...(filterChanged ? { page: 1, item: undefined } : {}), ...patch }
  const params = new URLSearchParams()
  if (next.status !== 'pending') params.set('status', next.status)
  if (next.kind) params.set('kind', next.kind)
  if (next.sort !== 'newest') params.set('sort', next.sort)
  if (next.q) params.set('q', next.q)
  if (next.page > 1) params.set('sehife', String(next.page))
  if (next.item) params.set('item', next.item)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

/** «Ağaclar / Meyvə ağacları · 120 sm · 2 yaş · Dibçəkdə · Abşeron, Məhəmmədi» */
export function reviewDetails(item: ModerationItem): string {
  const { listing } = item
  const category = categoryById(listing.categoryId)?.name
  const sub = listing.subcategories?.length ? listing.subcategories.join(', ') : listing.subcategory
  const kind = category && sub ? `${category} / ${sub}` : (category ?? sub)
  // A service's card line is its areas: the place is already there.
  const place = listing.kind === 'service' ? undefined : placeLabel(listing)
  return [kind, ...listing.attributes, place].filter(Boolean).join(' · ')
}

/** «38 ₼ · ədəd», «Razılaşma ilə» */
export function reviewPrice(item: ModerationItem): string {
  const price = listingPrice(item.listing)
  return price.unit ? `${price.amount} ${price.unit}` : price.amount
}

/** «Abşeron Tingçilik · Elvin Əliyev · +994 50 555 12 34 · Təsdiqlənmiş biznes · 24 aktiv elan · 2021-dən» */
export function sellerLine(item: ModerationItem): string {
  const { seller, listing } = item
  const business = seller.accountType === 'business'
  return [
    seller.name,
    listing.contactName && listing.contactName !== seller.name ? listing.contactName : undefined,
    listing.contactPhone,
    business ? (seller.verified ? 'Təsdiqlənmiş biznes' : 'Biznes hesabı') : 'Fərdi hesab',
    business ? `${seller.activeListings} aktiv elan` : undefined,
    seller.memberSince ? `${ordinal(seller.memberSince)} ildən GreenStore-da` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

export interface ReviewCheck {
  text: string
  /** `false`: the moderator should look at it (an unverified number, no photo) */
  ok: boolean
}

/** The checklist under the description: what the listing has and what needs a look. */
export function reviewChecks(item: ModerationItem): ReviewCheck[] {
  const { listing } = item
  const priced = listing.priceType !== 'agreement' && listing.price > 0
  return [
    { text: priced ? 'Qiymət göstərilib' : 'Qiymət: razılaşma ilə', ok: true },
    item.contactPhoneVerified ? { text: 'Əlaqə nömrəsi təsdiqlənib', ok: true } : { text: 'Əlaqə nömrəsi təsdiqlənməyib', ok: false },
    item.photoCount > 0 ? { text: `${item.photoCount} şəkil əlavə edilib`, ok: true } : { text: 'Şəkil yoxdur', ok: false },
    ...(listing.phoneHidden ? [{ text: 'Nömrə gizlədilib: yalnız WhatsApp', ok: true }] : []),
  ]
}

const FIELD_LABELS: Record<string, string> = {
  kind: 'Elanın növü',
  categoryId: 'Kateqoriya',
  subcategoryId: 'Alt kateqoriya',
  subcategoryIds: 'Xidmətin növü',
  title: 'Başlıq',
  description: 'Təsvir',
  'plant.species': 'Növün adı',
  'plant.heightCm': 'Hündürlük, sm',
  'plant.ageYears': 'Yaş',
  'plant.rootSystem': 'Kök sistemi',
  'plant.potLitres': 'Dibçəyin həcmi, litr',
  'plant.sun': 'İşıq',
  'plant.water': 'Suvarma',
  'plant.frostHardinessC': 'Şaxtaya davamlılıq, °C',
  'plant.foliage': 'Yarpaq',
  'plant.plantingMonths': 'Əkin ayları',
  availability: 'Mövcudluq',
  priceType: 'Qiymət növü',
  price: 'Qiymət',
  priceUnit: 'Vahid',
  wholesale: 'Topdan qiymət',
  quantityAvailable: 'Stokda',
  cityId: 'Şəhər',
  area: 'Ərazi',
  deliveryAvailable: 'Çatdırılma',
  deliveryAreas: 'Çatdırılma əraziləri',
  plantingAvailable: 'Əkin xidməti',
  serviceCityIds: 'Xidmət əraziləri',
  contactName: 'Əlaqə üçün ad',
  contactPhone: 'Telefon',
  whatsapp: 'WhatsApp',
  phoneHidden: 'Nömrə gizlədilib',
  photos: 'Şəkillərin sayı',
  'photos.order': 'Şəkillər',
}

const PRICE_TYPES: Record<string, string> = { fixed: 'Sabit', negotiable: 'Razılaşma mümkündür', agreement: 'Razılaşma ilə' }
const AVAILABILITY: Record<string, string> = { 'in-stock': 'Satışdadır', 'on-order': 'Sifarişlə' }
const CODES: Record<string, Record<string, string>> = {
  priceType: PRICE_TYPES,
  priceUnit: priceUnitLabels,
  availability: AVAILABILITY,
  'plant.rootSystem': rootSystemLabels,
  'plant.sun': sunLabels,
  'plant.water': waterLabels,
  'plant.foliage': foliageLabels,
}

const SHORT = 90

/** A product sub-category's or a service type's name (service types live in data/services.ts). */
const subOrServiceName = (id: string) => subcategoryById(id)?.name ?? serviceCategories.find((c) => c.id === id)?.name ?? id

/** One value of a change as the moderator reads it: names instead of ids and codes, «bəli» / «xeyr», long text cut. */
function changeValue(field: string, value: string | undefined): string {
  if (value === undefined || value === '') return '—'
  if (value === 'true') return 'bəli'
  if (value === 'false') return 'xeyr'
  if (field === 'categoryId') return categoryById(value)?.name ?? value
  if (field === 'subcategoryId') return subOrServiceName(value)
  if (field === 'subcategoryIds') return value.split(',').map((id) => subOrServiceName(id.trim())).join(', ')
  if (field === 'cityId') return cityName(value)
  if (field === 'serviceCityIds') return value.split(',').map((id) => cityName(id.trim())).join(', ')
  if (field === 'price' && Number.isFinite(Number(value))) return formatPrice(Number(value))
  const label = CODES[field]?.[value]
  if (label) return label
  return value.length > SHORT ? `${value.slice(0, SHORT - 1)}…` : value
}

/** «Qiymət: 145 ₼ → 120 ₼», «Şəkillər: sıra dəyişib» */
export function changeLine(change: ModerationChange): { label: string; before: string; after: string } {
  const label = FIELD_LABELS[change.field] ?? (change.field.startsWith('attributes.') ? change.field.slice('attributes.'.length) : change.field)
  return { label, before: changeValue(change.field, change.before), after: changeValue(change.field, change.after) }
}

/** The queue row's badge. */
export function itemBadge(item: Pick<ModerationItem, 'status' | 'kind'>): { tone: 'success' | 'danger' | 'warning'; label: string } {
  if (item.status === 'approved') return { tone: 'success', label: 'Təsdiqlənib' }
  if (item.status === 'rejected') return { tone: 'danger', label: 'Rədd edilib' }
  return { tone: 'warning', label: item.kind === 'recheck' ? 'Təkrar yoxlama' : 'Yoxlamada' }
}
