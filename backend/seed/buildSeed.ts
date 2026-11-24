/**
 * Builds the API's seed files and the mock-parity vectors from the demo data in src/data (DATABASE.md §7).
 *
 * Run `node backend/seed/export.mjs` to write them; src/test/backendSeed.test.ts fails when a committed file no longer
 * matches what this module builds (src/data changed without a re-export). Pure: no file system access here.
 *
 * - seed/reference/*.json: categories with sub-categories, cities, promotion packages. Written by the API's seeder in
 *   every environment, only when missing.
 * - seed/demo/*.json: users, sellers, product listings and services. Development and Staging only (Seed:Demo).
 * - contracts/*-search-parity.json: queries run against the mock (runSearch, searchServices) with their results, keyed
 *   by listing number. The API's integration tests run the same queries on the seeded database and expect the same
 *   listings in the same order.
 *
 * Russian and English names are DRAFT translations (backend/seed/README.md): a native speaker must review them.
 */
import { categories } from '@/data/categories'
import { cities } from '@/data/cities'
import { listings } from '@/data/listings'
import { promotionPackages } from '@/data/promotions'
import { sellers } from '@/data/sellers'
import { providers, serviceCategories, services } from '@/data/services'
import { emptySearchState, runSearch, type SearchState } from '@/features/search/searchState'
import { searchServices, type ServiceQuery } from '@/features/services/query'
import { listingFilterParams, serviceSearchParams } from '@/services/apiQuery'
import type { ListingSort } from '@/services/marketplace'
import type { Listing, PlantFacts, PriceUnit, Service } from '@/types'

/* ---------- Draft translations (ru, en) ---------- */

type Names = { ru: string; en: string }

/** DRAFT: to be reviewed by native speakers. «Güllər» is the flowers category here (petunias, peonies), not roses. */
const categoryNames: Record<string, Names> = {
  agaclar: { ru: 'Деревья', en: 'Trees' },
  'agaclar-meyve': { ru: 'Плодовые деревья', en: 'Fruit trees' },
  'agaclar-enliyarpaqli-yarpaqtoken': { ru: 'Листопадные лиственные деревья', en: 'Deciduous broadleaf trees' },
  'agaclar-enliyarpaqli-hemiseyasil': { ru: 'Вечнозелёные лиственные деревья', en: 'Evergreen broadleaf trees' },
  'agaclar-iyneyarpaqli': { ru: 'Хвойные деревья', en: 'Coniferous trees' },
  kollar: { ru: 'Кустарники', en: 'Shrubs' },
  'kollar-yarpaqtoken': { ru: 'Листопадные кустарники', en: 'Deciduous shrubs' },
  'kollar-hemiseyasil': { ru: 'Вечнозелёные кустарники', en: 'Evergreen shrubs' },
  guller: { ru: 'Цветы', en: 'Flowers' },
  'guller-movsumi': { ru: 'Сезонные цветы', en: 'Seasonal flowers' },
  'guller-coxillik': { ru: 'Многолетние цветы', en: 'Perennial flowers' },
  sarmasiqlar: { ru: 'Вьющиеся растения', en: 'Climbing plants' },
  'sarmasiqlar-hemiseyasil': { ru: 'Вечнозелёные вьющиеся растения', en: 'Evergreen climbers' },
  'sarmasiqlar-cicekli': { ru: 'Цветущие вьющиеся растения', en: 'Flowering climbers' },
  'sarmasiqlar-yarpaqtoken': { ru: 'Листопадные вьющиеся растения', en: 'Deciduous climbers' },
  'yer-ortucu-bitkiler': { ru: 'Почвопокровные растения', en: 'Ground cover plants' },
  'yer-ortucu-bitkiler-hemiseyasil': { ru: 'Вечнозелёные', en: 'Evergreen' },
  'yer-ortucu-bitkiler-cicekli': { ru: 'Цветущие', en: 'Flowering' },
  'yer-ortucu-bitkiler-iyneyarpaqli': { ru: 'Хвойные', en: 'Coniferous' },
  'yer-ortucu-bitkiler-sukkulentler': { ru: 'Суккуленты', en: 'Succulents' },
  'yer-ortucu-bitkiler-ot-tipli': { ru: 'Травянистые', en: 'Grass-like' },
  'yer-ortucu-bitkiler-surunen-yarpaqli': { ru: 'Стелющиеся', en: 'Trailing' },
  'landsaft-xidmetleri': { ru: 'Садовые услуги', en: 'Garden services' },
  'landsaft-dizayni': { ru: 'Ландшафтный дизайн', en: 'Landscape design' },
  'heyetyani-yasillasdirma': { ru: 'Озеленение придомовых участков', en: 'Yard landscaping' },
  'agac-ekilmesi': { ru: 'Посадка деревьев', en: 'Tree planting' },
  'avtomatik-suvarma': { ru: 'Системы автоматического полива', en: 'Automatic irrigation systems' },
  'cim-salinmasi': { ru: 'Укладка газона', en: 'Lawn installation' },
  'bag-baximi': { ru: 'Уход за садом', en: 'Garden care' },
}

const categoryDescriptions: Record<string, Names> = {
  agaclar: { ru: 'Декоративные и плодовые деревья, хвойные', en: 'Ornamental and fruit trees, conifers' },
}

/** DRAFT. */
const cityNames: Record<string, Names> = {
  baki: { ru: 'Баку', en: 'Baku' },
  abseron: { ru: 'Апшерон', en: 'Absheron' },
  sumqayit: { ru: 'Сумгайыт', en: 'Sumgayit' },
  gence: { ru: 'Гянджа', en: 'Ganja' },
  seki: { ru: 'Шеки', en: 'Shaki' },
  quba: { ru: 'Губа', en: 'Guba' },
  lenkeran: { ru: 'Ленкорань', en: 'Lankaran' },
}

/**
 * DRAFT: promotion package names, summaries, benefits and option labels, keyed by the Azerbaijani text (labels such as
 * «7 gün» repeat across packages). «Önə çıxan» is «В топе» / «Featured»; the word "VIP" is never used.
 */
const promotionTexts: Record<string, Names> = {
  'İrəli çək': { ru: 'Поднять в списке', en: 'Bump up' },
  'Önə çıxar': { ru: 'Вывести в топ', en: 'Feature' },
  'Önə çıxar + İrəli çək': { ru: 'Вывести в топ + Поднять в списке', en: 'Feature + Bump up' },
  'Elan siyahıda yenidən ən yuxarı qalxır, sanki indi yerləşdirilib.': {
    ru: 'Объявление снова поднимается на самый верх списка, будто его только что разместили.',
    en: 'The listing goes back to the very top of the list, as if it had just been posted.',
  },
  'Elan ana səhifədə və axtarışın başında «Önə çıxan» nişanı ilə göstərilir.': {
    ru: 'Объявление показывается на главной странице и в начале поиска со значком «В топе».',
    en: 'The listing is shown on the home page and at the top of search results with the «Featured» badge.',
  },
  'Hər ikisi bir arada: həm nişan və ana səhifə, həm də hər gün siyahının başı.': {
    ru: 'Оба в одном: и значок с главной страницей, и каждый день вверху списка.',
    en: 'Both in one: the badge and the home page, and the top of the list every day.',
  },
  '«Ən yenilər» siyahısında yenidən birinci yerdə': { ru: 'Снова на первом месте в списке «Новые»', en: 'First again in the «Newest» list' },
  'Tarix yenilənir, elan təzə görünür': { ru: 'Дата обновляется, объявление выглядит свежим', en: 'The date is refreshed, the listing looks new' },
  'Gündə bir dəfə və ya bir neçə gün ardıcıl': { ru: 'Один раз или каждый день несколько дней подряд', en: 'Once, or every day for several days in a row' },
  'Ana səhifədə «Önə çıxan elanlar» bölməsində': { ru: 'На главной странице в разделе «Объявления в топе»', en: 'On the home page in the «Featured listings» section' },
  'Axtarış nəticələrinin başında': { ru: 'В начале результатов поиска', en: 'At the top of search results' },
  '«Önə çıxan» nişanı ilə seçilir': { ru: 'Выделяется значком «В топе»', en: 'Stands out with the «Featured» badge' },
  '«Önə çıxar»ın bütün üstünlükləri': { ru: 'Все преимущества «Вывести в топ»', en: 'Everything «Feature» gives' },
  'Hər gün avtomatik «İrəli çək»': { ru: 'Каждый день автоматически «Поднять в списке»', en: 'An automatic «Bump up» every day' },
  'Ayrı-ayrı almaqdan sərfəli': { ru: 'Выгоднее, чем покупать по отдельности', en: 'Cheaper than buying them separately' },
  '1 dəfə': { ru: '1 раз', en: 'Once' },
  '5 gün, hər gün': { ru: '5 дней, каждый день', en: '5 days, every day' },
  '10 gün, hər gün': { ru: '10 дней, каждый день', en: '10 days, every day' },
  '3 gün': { ru: '3 дня', en: '3 days' },
  '7 gün': { ru: '7 дней', en: '7 days' },
  '15 gün': { ru: '15 дней', en: '15 days' },
}

function localized(az: string, names: Names | undefined, what: string) {
  if (!names) throw new Error(`No draft ru/en names for ${what} «${az}»: add them to backend/seed/buildSeed.ts`)
  return { az, ru: names.ru, en: names.en }
}

/* ---------- Helpers ---------- */

/** The demo data's local times ("2026-10-12T09:00:00") are Baku time (UTC+4, no daylight saving) → UTC "…Z". */
export function bakuToUtc(local: string): string {
  return new Date(`${local}+04:00`).toISOString().replace('.000Z', 'Z')
}

/** "+994 50 555 12 34" → "+994505551234" (E.164, DATABASE.md §2). */
export function e164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('994') ? digits.slice(3) : digits.replace(/^0/, '')
  if (local.length !== 9) throw new Error(`Not an Azerbaijani phone number: ${phone}`)
  return `+994${local}`
}

const unique = <T,>(items: T[]) => Array.from(new Set(items))

const cityIdByName = new Map(cities.map((c) => [c.name, c.id]))

/** Values the «Elan yerləşdir» form would hold for a plant listing (features/posting/fromListing.ts does the same). */
function plantFormValues(plant: PlantFacts | undefined): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!plant) return attrs
  if (plant.species) attrs.species = plant.species
  if (plant.heightCm) {
    attrs.heightMin = String(plant.heightCm.min)
    if (plant.heightCm.max) attrs.heightMax = String(plant.heightCm.max)
  }
  if (plant.ageYears != null) attrs.age = String(plant.ageYears)
  if (plant.rootSystem) attrs.rootSystem = plant.rootSystem
  if (plant.potLitres) attrs.potLitres = String(plant.potLitres)
  if (plant.sun) attrs.sun = plant.sun
  if (plant.water) attrs.water = plant.water
  if (plant.frostHardinessC != null) attrs.frost = String(plant.frostHardinessC)
  if (plant.foliage) attrs.foliage = plant.foliage
  if (plant.plantingMonths?.length) attrs.plantingMonths = plant.plantingMonths.join(',')
  return attrs
}

/** Cover first, then the other photos in order, each address once; at most 12 (DATABASE.md §3.5). */
function photoList(cover: string, images: string[]): string[] {
  return unique([cover, ...images].filter(Boolean)).slice(0, 12)
}

/** Moderator reason texts of the demo → codes (backend-contract.md 3.5). */
const rejectionCodes: Record<string, string> = {
  'Şəkillərdə başqa bitki görünür. Satdığınız tinglərin öz şəkillərini əlavə edin və elanı yenidən göndərin.': 'bad-photos',
}

/* ---------- Reference data ---------- */

function referenceCategories() {
  const top = categories.map((c, i) => {
    const subs = c.kind === 'service' ? serviceCategories.map((s) => ({ id: s.id, name: s.name })) : c.subcategories
    return {
      id: c.id,
      kind: c.kind,
      form: c.form,
      icon: c.icon,
      name: localized(c.name, categoryNames[c.id], 'category'),
      ...(c.description ? { description: localized(c.description, categoryDescriptions[c.id], 'category description') } : {}),
      filters: c.attributes?.rootSystem?.filter ? [{ id: 'rootSystem', enabled: true }] : [],
      sortOrder: (i + 1) * 10,
      subcategories: subs.map((s, j) => ({ id: s.id, name: localized(s.name, categoryNames[s.id], 'sub-category'), sortOrder: (j + 1) * 10 })),
    }
  })
  return { $comment: comment('Categories (kind, form, icon) with their sub-categories. ru/en are DRAFT translations.'), items: top }
}

function referenceCities() {
  return {
    $comment: comment('Cities. ru/en are DRAFT translations.'),
    items: cities.map((c, i) => ({ id: c.id, name: localized(c.name, cityNames[c.id], 'city'), sortOrder: (i + 1) * 10 })),
  }
}

function referencePromotions() {
  return {
    $comment: comment('Promotion packages and their options (mock prices, AZN). ru/en are DRAFT translations.'),
    items: promotionPackages.map((p, i) => ({
      id: p.id,
      name: localized(p.name, promotionTexts[p.name], 'promotion package'),
      summary: localized(p.summary, promotionTexts[p.summary], 'promotion summary'),
      benefits: p.benefits.map((b) => localized(b, promotionTexts[b], 'promotion benefit')),
      sortOrder: (i + 1) * 10,
      options: p.options.map((o, j) => ({
        id: o.id,
        label: localized(o.label, promotionTexts[o.label], 'promotion option'),
        price: o.price,
        ...(o.days != null ? { days: o.days } : {}),
        ...(o.bumps != null ? { bumps: o.bumps } : {}),
        sortOrder: (j + 1) * 10,
      })),
    })),
  }
}

/* ---------- Demo data ---------- */

interface DemoUser {
  key: string
  fullName: string
  phone: string
  accountType: 'business' | 'individual'
  email?: string
  createdAt: string
}

/** Joined dates of the demo sellers: 1 March of `memberSince` (the data has the year only). */
const joined = (year: number | undefined) => `${year ?? 2024}-03-01T08:00:00Z`

/** Service providers without a phone in the demo data get one of these (sample numbers, not real). */
const providerPhones: Record<string, string> = {
  aquabag: '+994500000101',
  'bag-ustasi': '+994500000102',
  'quba-bag': '+994500000103',
}

/** Listings without a number in the data get one from here, in data order; services likewise. */
const FIRST_FREE_LISTING_NUMBER = 10601
const FIRST_FREE_SERVICE_NUMBER = 20317

function listingNumbers(): Map<string, number> {
  const numbers = new Map<string, number>()
  let next = FIRST_FREE_LISTING_NUMBER
  for (const l of listings) numbers.set(l.id, l.number ?? next++)
  return numbers
}

function serviceNumbers(): Map<string, number> {
  const numbers = new Map<string, number>()
  let next = FIRST_FREE_SERVICE_NUMBER
  for (const s of services) numbers.set(s.id, s.number ?? next++)
  return numbers
}

/** «Ən yenilər» of the services catalogue is the data order (query.ts): the first service is the newest. */
const servicePublishedAt = (index: number) => bakuToUtc(`2026-10-12T${String(18 - index).padStart(2, '0')}:00:00`)

function demoData() {
  const users = new Map<string, DemoUser>()
  const userByPhone = new Map<string, string>()
  const addUser = (key: string, user: Omit<DemoUser, 'key'>) => {
    const existing = userByPhone.get(user.phone)
    if (existing) return existing
    users.set(key, { key, ...user })
    userByPhone.set(user.phone, key)
    return key
  }

  /* Sellers and their owners */
  const sellerOwner = new Map<string, string>()
  const sellerRows = sellers.map((s) => {
    if (!s.phone || !s.businessKinds?.length) throw new Error(`Demo seller ${s.id} needs a phone and a business kind`)
    const owner = addUser(`owner-${s.id}`, {
      fullName: s.contactPerson ?? s.name,
      phone: e164(s.phone),
      accountType: 'business',
      ...(s.email ? { email: s.email } : {}),
      createdAt: joined(s.memberSince),
    })
    sellerOwner.set(s.id, owner)
    return {
      key: s.id,
      slug: s.slug,
      owner,
      name: s.name,
      businessKinds: s.businessKinds,
      cityId: s.cityId,
      ...(s.address ? { address: s.address } : {}),
      ...(s.location ? { location: s.location } : {}),
      ...(s.about ? { about: s.about } : {}),
      ...(s.terms ? { terms: s.terms } : {}),
      ...(s.hours ? { hours: s.hours } : {}),
      offers: s.offers ?? [],
      phone: e164(s.phone),
      whatsapp: Boolean(s.whatsapp),
      ...(s.email ? { email: s.email } : {}),
      ...(s.contactPerson ? { contactPerson: s.contactPerson } : {}),
      ...(s.instagram ? { instagram: s.instagram } : {}),
      ...(s.website ? { website: s.website } : {}),
      ...(s.responseMinutes ? { responseMinutes: s.responseMinutes } : {}),
      ...(s.logo ? { logo: s.logo } : {}),
      // The schema has a logo and a cover (DATABASE.md §3.3); the card image is the cover when there is none.
      cover: s.coverImage ?? s.image,
      verified: s.verified,
      createdAt: joined(s.memberSince),
    }
  })
  const sellerById = new Map(sellers.map((s) => [s.id, s]))

  /* Product listings */
  const numbers = listingNumbers()
  const listingRows = listings.map((l: Listing) => {
    const seller = l.sellerId ? sellerById.get(l.sellerId) : undefined
    const contactName = l.contactName ?? seller?.contactPerson ?? seller?.name
    const contactPhone = l.contactPhone ?? seller?.phone
    if (!contactName || !contactPhone) throw new Error(`Demo listing ${l.id} has no contact`)
    const owner = seller
      ? sellerOwner.get(seller.id)!
      : addUser(`contact-${e164(contactPhone).slice(4)}`, { fullName: contactName, phone: e164(contactPhone), accountType: 'individual', createdAt: '2025-06-01T08:00:00Z' })
    const category = categories.find((c) => c.id === l.categoryId)
    const subcategoryId = category?.subcategories.find((s) => s.name === l.subcategory)?.id
    if (l.subcategory && !subcategoryId) throw new Error(`Unknown sub-category «${l.subcategory}» of ${l.id}`)
    const published = bakuToUtc(l.publishedAt)
    const dates =
      l.status === 'pending' || l.status === 'rejected'
        ? { submittedAt: published }
        : { submittedAt: published, publishedAt: published, ...(l.expiresAt ? { expiresAt: bakuToUtc(l.expiresAt) } : {}) }
    const priceType = l.priceType ?? (l.price ? 'fixed' : 'agreement')
    return {
      key: l.id,
      number: numbers.get(l.id)!,
      status: l.status,
      owner,
      ...(seller ? { seller: seller.id } : {}),
      title: l.title,
      description: l.description ?? [],
      categoryId: l.categoryId,
      ...(subcategoryId ? { subcategoryId } : {}),
      cityId: l.cityId,
      ...(l.area ? { area: l.area } : {}),
      priceType,
      ...(priceType === 'agreement' ? {} : { price: l.price }),
      ...(l.priceUnit ? { priceUnit: l.priceUnit } : {}),
      ...(l.wholesale ? { wholesale: l.wholesale } : {}),
      ...(l.quantityAvailable != null ? { quantityAvailable: l.quantityAvailable } : {}),
      deliveryAvailable: Boolean(l.deliveryAvailable),
      ...(l.deliveryAreas ? { deliveryAreas: l.deliveryAreas } : {}),
      plantingAvailable: Boolean(l.plantingAvailable),
      contactName,
      contactPhone: e164(contactPhone),
      whatsapp: Boolean(l.whatsapp),
      phoneHidden: Boolean(l.phoneHidden),
      ...(l.plant ? { plant: l.plant } : {}),
      attributes: plantFormValues(l.plant),
      careTips: l.careTips ?? [],
      promoted: l.vip,
      views: l.views ?? 0,
      ...dates,
      ...(l.updatedAt ? { editedAt: bakuToUtc(l.updatedAt) } : {}),
      ...(l.status === 'rejected'
        ? { rejectionReasonCode: (l.rejectionReason && rejectionCodes[l.rejectionReason]) ?? 'other', ...(l.rejectionReason ? { rejectionNote: l.rejectionReason } : {}) }
        : {}),
      photos: photoList(l.cover, l.images),
    }
  })

  /* Services (listings of kind "service"), owned by the seller's owner or by the provider's own user */
  const serviceNumber = serviceNumbers()
  const serviceRows = services.map((s: Service, index) => {
    const provider = providers.find((p) => p.id === s.providerId)
    if (!provider) throw new Error(`Unknown provider ${s.providerId}`)
    const seller = provider.sellerId ? sellerById.get(provider.sellerId) : undefined
    const owner = seller
      ? sellerOwner.get(seller.id)!
      : addUser(`provider-${provider.id}`, { fullName: provider.name, phone: providerPhones[provider.id], accountType: 'individual', createdAt: '2025-06-01T08:00:00Z' })
    if (!seller && !providerPhones[provider.id]) throw new Error(`Provider ${provider.id} needs a demo phone`)
    const areas = s.areas.map((name) => {
      const id = cityIdByName.get(name)
      if (!id) throw new Error(`Unknown service area «${name}»`)
      return id
    })
    const price = servicePrice(s)
    const published = servicePublishedAt(index)
    return {
      key: s.id,
      number: serviceNumber.get(s.id)!,
      status: 'active',
      owner,
      ...(seller ? { seller: seller.id } : {}),
      title: s.title,
      description: s.description ?? [],
      categoryId: 'landsaft-xidmetleri',
      subcategoryId: s.categoryId,
      cityId: seller?.cityId ?? areas[0],
      ...price,
      areas,
      includes: s.includes ?? [],
      contactName: seller?.contactPerson ?? seller?.name ?? provider.name,
      contactPhone: seller?.phone ? e164(seller.phone) : providerPhones[provider.id],
      whatsapp: Boolean(seller?.whatsapp),
      phoneHidden: false,
      promoted: false,
      views: 0,
      submittedAt: published,
      publishedAt: published,
      photos: photoList(s.cover, s.images),
    }
  })

  return {
    users: { $comment: comment('Demo accounts (sample people and numbers, not real). They cannot sign in with a password.'), items: [...users.values()] },
    sellers: { $comment: comment('Demo business profiles. `owner` is a key in users.json; photos are paths under /public.'), items: sellerRows },
    listings: { $comment: comment('Demo product listings in every status. Photos are paths under /public (served by Next).'), items: listingRows },
    services: { $comment: comment('Demo services: listings of kind "service" under «Bağ xidmətləri»; `subcategoryId` is the service type.'), items: serviceRows },
  }
}

/** «25 ₼/m²-dən» → 25 per m²; «350 ₼-dən» → 350 (no unit); «Razılaşma yolu ilə» → by agreement. */
function servicePrice(s: Service): { priceType: 'fixed' | 'agreement'; price?: number; priceUnit?: PriceUnit } {
  if (s.priceFrom == null) return { priceType: 'agreement' }
  const unit: PriceUnit | undefined = s.priceLabel.includes('/m²') ? 'sqm' : s.priceLabel.includes('/saat') ? 'hour' : undefined
  return { priceType: 'fixed', price: s.priceFrom, ...(unit ? { priceUnit: unit } : {}) }
}

/* ---------- Mock parity vectors ---------- */

const state = (patch: Partial<SearchState>): SearchState => ({ ...emptySearchState, ...patch })

/**
 * Catalogue queries whose results the API must reproduce. Left out on purpose (the API differs, see
 * backend/seed/README.md): the age filter (the mock reads the age from the card line, the API from the plant facts),
 * «Fərdi satıcı» (the mock finds none), words that only the extra search fields match (species, area, ru/en names) and card-line words (the API
 * builds the card line from the plant facts, the Figma listings wrote theirs by hand).
 */
const listingQueries: Array<{ name: string; state: SearchState; sort: ListingSort }> = [
  { name: 'everything, newest first', state: state({}), sort: 'newest' },
  { name: 'everything, cheapest first', state: state({}), sort: 'price-asc' },
  { name: 'everything, dearest first', state: state({}), sort: 'price-desc' },
  { name: 'one word in the title', state: state({ q: 'zeytun' }), sort: 'newest' },
  { name: 'Azerbaijani letters typed without them', state: state({ q: 'agac' }), sort: 'newest' },
  { name: 'two words, both must match', state: state({ q: 'Tuya Smaragd' }), sort: 'newest' },
  { name: 'a city name as the search word', state: state({ q: 'Quba' }), sort: 'newest' },
  { name: 'a category name as the search word', state: state({ q: 'kollar' }), sort: 'newest' },
  { name: 'category', state: state({ categoryId: 'agaclar' }), sort: 'newest' },
  { name: 'sub-category', state: state({ categoryId: 'kollar', subcategory: 'kollar-hemiseyasil' }), sort: 'newest' },
  { name: 'two cities', state: state({ cityIds: ['baki', 'abseron'] }), sort: 'newest' },
  { name: 'price range, cheapest first', state: state({ min: '50', max: '150' }), sort: 'price-asc' },
  { name: 'maximum price only', state: state({ max: '10' }), sort: 'price-desc' },
  { name: 'promoted only', state: state({ vip: true }), sort: 'newest' },
  { name: 'delivery only', state: state({ delivery: true }), sort: 'newest' },
  { name: 'business sellers only', state: state({ sellerType: 'biznes' }), sort: 'newest' },
  { name: 'height range', state: state({ height: '100-200' }), sort: 'newest' },
  { name: 'minimum height', state: state({ height: '300-' }), sort: 'newest' },
  { name: 'root system', state: state({ categoryId: 'agaclar', root: 'aciq-kok' }), sort: 'newest' },
  { name: 'filters combined', state: state({ q: 'ağac', categoryId: 'agaclar', cityIds: ['abseron'], delivery: true }), sort: 'price-desc' },
  { name: 'nothing found', state: state({ q: 'kaktus' }), sort: 'newest' },
  // Typed or crafted URLs outside the API's ranges (src/services/apiQuery.ts brings them into range).
  { name: 'a negative minimum price', state: state({ min: '-5' }), sort: 'price-asc' },
  { name: 'a maximum price above every possible price', state: state({ max: '100000000000' }), sort: 'price-asc' },
  { name: 'a minimum price above every possible price', state: state({ min: '1e20' }), sort: 'newest' },
  { name: 'a height range ending past int32', state: state({ height: '100-99999999999' }), sort: 'newest' },
  { name: 'a minimum height past int32', state: state({ height: '3000000000-' }), sort: 'newest' },
]

/** The API query string for a catalogue state: the same parameters the site's API repository sends. */
function listingApiQuery(s: SearchState, sort: ListingSort): string {
  const params = listingFilterParams(s)
  params.set('sort', sort)
  return params.toString()
}

/** Consecutive results with the same sort key: their order is not defined (the mock keeps data order), only the group. */
function groupBy<T>(items: T[], key: (item: T) => string, value: (item: T) => number): number[][] {
  const groups: Array<{ key: string; items: number[] }> = []
  for (const item of items) {
    const k = key(item)
    const last = groups[groups.length - 1]
    if (last && last.key === k) last.items.push(value(item))
    else groups.push({ key: k, items: [value(item)] })
  }
  return groups.map((g) => g.items.sort((a, b) => a - b))
}

function listingParity() {
  const numbers = listingNumbers()
  const sortKey = (sort: ListingSort) => (l: Listing) => (sort === 'newest' ? `${l.vip}|${l.publishedAt}` : String(l.price))
  return {
    $comment: comment(
      'Catalogue queries run against the mock (runSearch) with the listing numbers they return, in order. `groups`: results with the same sort key, whose order inside the group is not defined. Run against the seeded database by ListingSearchParityTests.',
    ),
    pageSize: 60,
    queries: listingQueries.map((q) => {
      const results = runSearch(q.state, q.sort)
      return { name: q.name, query: listingApiQuery(q.state, q.sort), total: results.length, groups: groupBy(results, sortKey(q.sort), (l) => numbers.get(l.id)!) }
    }),
  }
}

const serviceQuery = (patch: Partial<ServiceQuery>): ServiceQuery => ({ q: '', tab: 'all', sort: 'newest', page: 1, ...patch })

/** «Fərdi ustalar» is left out: the mock has no individual providers, the demo database has three. */
const serviceQueries: Array<{ name: string; query: ServiceQuery }> = [
  { name: 'everything, newest first', query: serviceQuery({}) },
  { name: 'cheapest first, by agreement last', query: serviceQuery({ sort: 'price-asc' }) },
  { name: 'dearest first', query: serviceQuery({ sort: 'price-desc' }) },
  { name: 'service type', query: serviceQuery({ categoryId: 'landsaft-dizayni' }) },
  { name: 'service area', query: serviceQuery({ cityId: 'quba' }) },
  { name: 'search word', query: serviceQuery({ q: 'suvarma' }) },
  { name: 'search word in the checklist', query: serviceQuery({ q: '3D' }) },
  { name: 'provider name', query: serviceQuery({ q: 'Bağ Ustası' }) },
  { name: 'verified companies', query: serviceQuery({ tab: 'sirketler' }) },
  { name: 'price range', query: serviceQuery({ minPrice: 10, maxPrice: 200 }) },
  // Typed or crafted URLs outside the API's ranges (src/services/apiQuery.ts brings them into range).
  { name: 'a maximum price above every possible price', query: serviceQuery({ maxPrice: 100000000000 }) },
  { name: 'a page past the end', query: serviceQuery({ page: 99999999999 }) },
]

/** The API query string of a services catalogue page: the same one the site's API repository sends. */
function serviceApiQuery(q: ServiceQuery): string {
  return serviceSearchParams(q).toString()
}

function serviceParity() {
  const numbers = serviceNumbers()
  return {
    $comment: comment('Services catalogue queries run against the mock (searchServices, 6 per page) with the service numbers of the page asked for (page 1 unless the query says otherwise; a page past the end is the last page), in order. Run by ServiceSearchParityTests.'),
    queries: serviceQueries.map((q) => {
      const result = searchServices(q.query)
      return { name: q.name, query: serviceApiQuery(q.query), total: result.total, items: result.items.map((s) => numbers.get(s.id)!) }
    }),
  }
}

/* ---------- Files ---------- */

function comment(text: string): string {
  return `${text} Generated from src/data by backend/seed/export.mjs: do not edit by hand.`
}

/** Every generated file, keyed by its path under backend/. */
export function buildSeedFiles(): Record<string, unknown> {
  const demo = demoData()
  return {
    'seed/reference/categories.json': referenceCategories(),
    'seed/reference/cities.json': referenceCities(),
    'seed/reference/promotions.json': referencePromotions(),
    'seed/demo/users.json': demo.users,
    'seed/demo/sellers.json': demo.sellers,
    'seed/demo/listings.json': demo.listings,
    'seed/demo/services.json': demo.services,
    'contracts/listing-search-parity.json': listingParity(),
    'contracts/service-search-parity.json': serviceParity(),
  }
}

/** The text a file is written with: 2-space JSON and a final newline. */
export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
