import type { Listing, ListingStats, OpeningHours, Seller, Service } from '@/types'
import { createDraft, DESCRIPTION_MAX, TITLE_MAX, type PostingDraft } from '@/features/posting/draft'
import type { WorstCaseMode } from './worstCase'

/*
 * Worst-case data for the page surfaces of /dev/worst-case/sehifeler (break-ui, Nov 2026): the listing page, the
 * seller page, the cabinet rows and the posting previews. Every value is something a real seller could produce or
 * the limit the posting form enforces (TITLE_MAX 80, price ≤ 1 000 000, wholesale minimum ≤ 1 000 000, stock
 * ≤ 10 000 000, species 60, area 90, delivery 80, name 50, description 3000). Seller fields come from the API and
 * have no limit in the contract, so they get long but believable values. Shaped exactly like the demo data: each
 * fixture spreads a demo record and overrides fields, so nothing here reaches production pages.
 */

/** 80 characters: the posting form's limit. */
export const WORST_TITLE = 'Leylandi sərvi tingləri canlı hasar üçün, dibçəkdə, 180–200 sm, 15 yaşlı, topdan'.slice(0, TITLE_MAX)

const longDescription = [
  'Təsərrüfatımızda yetişdirilən Leylandi sərvi tingləri canlı hasar və küləkdən qorunma zolağı üçün ən sürətli böyüyən həmişəyaşıl bitkilərdəndir. Tinglər 15 litrlik dibçəklərdə, damcı suvarma ilə yetişdirilib; kök sistemi tam formalaşıb, köçürmədən sonra itki demək olar ki, olmur.',
  'Topdan alışda (100 ədəddən) qiymət razılaşma ilə endirilir. Bakı, Abşeron, Sumqayıt və Xızı istiqamətinə öz maşınımızla çatdırırıq, rayonlara isə yük daşıma şirkəti ilə göndəririk. Əkin xidməti də göstəririk: hasar xətti boyunca xəndək qazılır, torpaq qarışığı və gübrə əlavə edilir, ilk 2 ay suvarma cədvəli verilir.',
  'Videoları və əvvəlki işlərimizi Instagram səhifəmizdə görə bilərsiniz: https://www.instagram.com/abseron.tingcilik.official.store/reels/leylandi-hasar-2026-payiz-kampaniyasi',
  'Ünvan: Abşeron rayonu, Məhəmmədi qəsəbəsi, Zabrat–Məhəmmədi yolu 14-cü km, «Yaşıl Vadi» istixanalar kompleksi, 3-cü darvaza. Gəlməzdən əvvəl zəng edin: təsərrüfat bazar ertəsi dezinfeksiya üçün bağlıdır.',
]
  .join('\n')
  .slice(0, DESCRIPTION_MAX)
  .split('\n')

const careTips = [
  'Əkindən sonra ilk ay həftədə 2 dəfə bol suvarın, sonra torpaq qurudaqca.',
  'Hasar üçün tingləri 60–80 sm aralıqla, bir xətt boyunca əkin; sıx hasar üçün iki cərgə şahmat qaydasında.',
  'Formalaşdırıcı budamanı yazda və yayın sonunda edin: yan budaqları 1/3 qədər qısaldın, zirvəni istənilən hündürlüyə çatanda kəsin.',
  'Şaxtalı gecələrdə gənc tinglərin dibini malçlayın.',
  'Gübrəni mart–may aylarında ayda bir dəfə verin.',
  'Xəstəlik əlamətləri (saralan iynələr) görsəniz, şəkil göndərin — pulsuz məsləhət veririk.',
]

/** One 404 among the photos, and the gallery at its 12-photo limit. */
function gallery(images: string[]): string[] {
  const twelve = Array.from({ length: 12 }, (_, i) => images[i % images.length])
  twelve[3] = '/foto-yoxdur-3.jpg'
  return twelve
}

export function worstListing(demo: Listing, mode: WorstCaseMode): Listing {
  if (mode === 'demo') return demo
  if (mode === 'empty')
    // Only what the form requires: no plant facts, no tips, no stock, no delivery, one photo, nobody has looked yet.
    return {
      ...demo,
      title: 'Gül',
      price: 0,
      priceType: 'agreement',
      priceUnit: undefined,
      wholesale: undefined,
      quantityAvailable: undefined,
      area: undefined,
      plant: undefined,
      careTips: undefined,
      plantingAvailable: false,
      deliveryAvailable: false,
      deliveryAreas: undefined,
      images: demo.images.slice(0, 1),
      description: ['Bağdan kəsilmiş qızılgül kolları, yerində baxmaq olar.'],
      specs: undefined,
      attributes: [],
      views: 0,
      vip: false,
      promotion: undefined,
      whatsapp: false,
    }
  if (mode === 'one')
    return {
      ...demo,
      price: 1,
      priceUnit: 'piece',
      wholesale: { price: 1, minQuantity: 2 },
      quantityAvailable: 1,
      plant: { ...demo.plant, ageYears: 1, heightCm: { min: 1 }, plantingMonths: [1] },
      careTips: careTips.slice(0, 1),
      images: demo.images.slice(0, 1),
      views: 1,
    }
  return {
    ...demo,
    number: 9_999_999,
    title: WORST_TITLE,
    price: 1_000_000,
    priceType: 'negotiable',
    priceUnit: 'bag',
    wholesale: { price: 999_999, minQuantity: 1_000_000 },
    quantityAvailable: 10_000_000,
    cityId: 'lenkeran',
    area: 'Lənkəran rayonu, Hirkan Milli Parkının yaxınlığı, Böyük Bəşli kəndi, Mirzə Ələkbər küçəsi'.slice(0, 90),
    deliveryAreas: 'Bakı, Abşeron, Sumqayıt, Gəncə, Şəki, Quba, Lənkəran və bütün rayonlar (razılaşma ilə)'.slice(0, 80),
    plantingAvailable: true,
    deliveryAvailable: true,
    plant: {
      species: "× Cupressocyparis leylandii 'Castlewellan Gold' variegata".slice(0, 60),
      heightCm: { min: 180, max: 2999 },
      ageYears: 200,
      rootSystem: 'rootball',
      sun: 'part-shade',
      water: 'high',
      foliage: 'evergreen',
      frostHardinessC: -30,
      plantingMonths: [1, 3, 5, 7, 9, 11],
    },
    careTips,
    images: gallery(demo.images),
    description: longDescription,
    contactName: 'Məmmədəliyev Əbdülrəhimbəy Hacıağa oğlu'.slice(0, 50),
    views: 1_234_567,
    vip: true,
  }
}


export function worstSeller(demo: Seller, mode: WorstCaseMode): Seller {
  if (mode === 'demo') return demo
  if (mode === 'empty')
    return {
      ...demo,
      kind: undefined,
      businessKind: undefined,
      verified: false,
      memberSince: undefined,
      coverImage: undefined,
      logo: undefined,
      about: undefined,
      terms: undefined,
      address: undefined,
      hours: undefined,
      location: undefined,
      offers: undefined,
      instagram: undefined,
      website: undefined,
      whatsapp: false,
      responseMinutes: undefined,
      activeListings: 0,
    }
  if (mode === 'one') return { ...demo, activeListings: 1, responseMinutes: 1, memberSince: 2026, offers: demo.offers?.slice(0, 1) }
  return {
    ...demo,
    name: 'Abşeron Tingçilik və Landşaft Dizayn Mərkəzi MMC',
    kind: 'Tingçilik təsərrüfatı, bağ mərkəzi və landşaft şirkəti',
    memberSince: 2026,
    activeListings: 12_345,
    logo: '/logo-yoxdur.png',
    about: [demo.about, demo.about, demo.about].join(' '),
    terms: `${demo.terms} Topdan sifarişlər (100 ədəddən) üçün ilkin ödəniş 30 %-dir, qalanı təhvildə. Rayonlara göndəriş yük daşıma şirkəti ilə, alıcının hesabına.`,
    address: 'Abşeron rayonu, Məhəmmədi qəsəbəsi, Zabrat–Məhəmmədi yolu 14-cü km, «Yaşıl Vadi» istixanalar kompleksi, 3-cü darvaza',
    // Every weekday different: no two days group into one row.
    hours: [
      { day: 1, open: '08:30', close: '19:30' },
      { day: 2, open: '08:00', close: '18:00' },
      { day: 3, open: '08:30', close: '19:30' },
      { day: 4, open: '09:00', close: '20:00' },
      { day: 5, open: '08:30', close: '13:00' },
      { day: 6, open: '10:00', close: '15:00' },
      { day: 7, closed: true },
    ] satisfies OpeningHours[],
    instagram: 'abseron.tingcilik.official.store.baku',
    website: 'https://www.abseron-tingcilik-ve-landsaft-dizayn-merkezi.example.az/az/katalog',
    responseMinutes: 2 * 24 * 60,
  }
}

export function worstServices(all: Service[], own: Service[], mode: WorstCaseMode): Service[] {
  if (mode === 'empty') return []
  if (mode === 'one') return own.slice(0, 1)
  if (mode === 'worst') return all.slice(0, 7)
  return own
}

/* ---------- Cabinet rows ---------- */

const stats = (views: number, phoneReveals: number, favourites: number): ListingStats => ({
  views,
  phoneReveals,
  favourites,
  viewsByDay: Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 25 + i)).toISOString(), views: Math.round((views / 14) * (0.4 + (i % 5) * 0.3)) })),
})

/** Six rows, six failures: longest title + long rejection, huge numbers + promotion, no photo, broken photo, price 0, no number. */
export function worstRows(demo: Listing[], mode: WorstCaseMode, now: number): Array<{ listing: Listing; stats?: ListingStats }> {
  const day = 86_400_000
  if (mode === 'empty') return []
  if (mode === 'demo') return demo.slice(0, 5).map((listing) => ({ listing, stats: stats(listing.views ?? 0, 12, 4) }))
  const [a, b, c, d, e, f] = [...demo, ...demo]
  if (mode === 'one') return [{ listing: { ...a, status: 'active', expiresAt: new Date(now + day).toISOString() }, stats: stats(1, 1, 1) }]
  return [
    {
      listing: {
        ...a,
        id: 'wc-row-rejected',
        title: WORST_TITLE,
        status: 'rejected',
        price: 1_000_000,
        priceUnit: 'bag',
        rejectionReason:
          'Şəkillərdə başqa bitki görünür və biri internetdən götürülüb; təsvirdə telefon nömrəsi və başqa saytın ünvanı var; qiymət «1 000 000 ₼» yazılıb, amma təsvirdə «razılaşma ilə» deyilir. Şəkilləri öz tinglərinizlə əvəz edin, təsvirdən nömrəni və keçidi silin, qiyməti dəqiqləşdirin və yenidən göndərin.',
      },
      stats: stats(0, 0, 0),
    },
    {
      listing: {
        ...b,
        id: 'wc-row-numbers',
        status: 'active',
        number: 9_999_999,
        price: 999_999,
        priceUnit: 'set',
        expiresAt: new Date(now + day / 2).toISOString(),
        promotion: { packageId: 'paket', until: new Date(now + 15 * day).toISOString() },
      },
      stats: stats(1_234_567, 98_765, 12_345),
    },
    { listing: { ...c, id: 'wc-row-nophoto', title: 'Gül', status: 'pending', cover: '', thumbnail: undefined }, stats: stats(1, 0, 1) },
    { listing: { ...d, id: 'wc-row-broken', status: 'expired', thumbnail: '/foto-yoxdur.jpg', cover: '/foto-yoxdur.jpg' }, stats: stats(48, 2, 0) },
    { listing: { ...e, id: 'wc-row-zero', status: 'inactive', price: 0, priceType: 'agreement', cityId: 'lenkeran' }, stats: undefined },
    { listing: { ...f, id: 'wc-row-nonumber', status: 'active', number: undefined, title: "Chamaecyparis lawsoniana 'Ellwoodii' — 120 sm", expiresAt: new Date(now + 29 * day).toISOString() }, stats: stats(12, 0, 0) },
  ]
}

/** The draft behind the posting card preview (aside of steps 1–5). */
export function worstDraft(mode: WorstCaseMode): PostingDraft {
  const base = createDraft()
  if (mode === 'empty') return base
  if (mode === 'demo')
    return { ...base, kind: 'product', categoryId: 'agaclar', title: 'Tuya Smaragd — 140 sm, dibçəkdə', price: '55', priceUnit: 'piece', cityId: 'abseron', attrs: { heightMin: '140', age: '3', rootSystem: 'container' } }
  if (mode === 'one') return { ...base, kind: 'product', categoryId: 'agaclar', title: 'Gül', price: '1', priceUnit: 'piece', cityId: 'baki', attrs: { heightMin: '1' } }
  return {
    ...base,
    kind: 'product',
    categoryId: 'agaclar',
    title: WORST_TITLE,
    price: '1000000',
    priceType: 'negotiable',
    priceUnit: 'bag',
    cityId: 'lenkeran',
    attrs: { heightMin: '180', heightMax: '2999', age: '200', rootSystem: 'rootball', species: "× Cupressocyparis leylandii 'Castlewellan Gold'" },
  }
}
