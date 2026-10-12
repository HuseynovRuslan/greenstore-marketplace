import type { Listing } from '@/types'

const img = (file: string) => `/images/listings/${file}.webp`

/**
 * Product listings extracted from the Figma file.
 *
 * Source frames: "Ana səhifə" 1440 / 768 / 390, "Məhsul axtarışı", "Zeytun ağacı",
 * "Abşeron Tingçilik", "Seçilmişlər · 390" and "Vizual komponentlər".
 * Title, price, attribute line, city and date are copied verbatim from the cards.
 *
 * Images: Figma uses a different photo of the same product in each frame. `cover` is the photo the
 * 1440 desktop frames use on the card; `images` keeps every photo the design attaches to the listing,
 * in frame order (detail-page gallery first where one exists). See FIGMA_AUDIT.md → "Asset inventory".
 *
 * `categoryId` is not written on the cards; it follows the search page (filter "Ağaclar" → its 6 results)
 * and the product type for the rest — documented as inferred in FIGMA_AUDIT.md. `subcategory: 'Dekorativ ağaclar'`
 * follows the Figma filter state ("Ağaclar / Dekorativ ağaclar" → the same 6 results, mobile filter panel).
 * `publishedAt` times only preserve the Figma ordering of "Son elanlar" (all cards say "12 oktyabr").
 */
export const listings: Listing[] = [
  {
    id: 'zeytun-agaci',
    slug: 'zeytun-agaci-olea-europaea',
    number: 10482,
    title: 'Zeytun ağacı — Olea europaea',
    price: 145,
    priceNote: 'Bir ağac üçün · Satıcı ilə razılaşma əsasında',
    attributes: ['180–200 sm', '5 yaş', 'dibçəkdə'],
    cityId: 'abseron',
    publishedAt: '2026-10-12T09:00:00',
    vip: true,
    categoryId: 'agaclar',
    subcategory: 'Dekorativ ağaclar',
    sellerId: 'abseron-tingcilik',
    cover: img('zeytun-agaci-1'),
    thumbnail: '/images/dashboard/my-listing-1.webp',
    images: [
      img('zeytun-agaci-gallery-1'),
      img('zeytun-agaci-gallery-2'),
      img('zeytun-agaci-gallery-3'),
      img('zeytun-agaci-gallery-4'),
      img('zeytun-agaci-1'),
      img('zeytun-agaci-5'),
      img('zeytun-agaci-2'),
      img('zeytun-agaci-3'),
      img('zeytun-agaci-4'),
      '/images/dashboard/my-listing-1.webp',
    ],
    deliveryAvailable: true,
    status: 'active',
    views: 248,
    specs: [
      { label: 'Kateqoriya', value: 'Ağaclar / Dekorativ ağaclar' },
      { label: 'Növ', value: 'Olea europaea' },
      { label: 'Hündürlük', value: '180–200 sm' },
      { label: 'Yaş', value: '5 yaş' },
      { label: 'Yetişdirmə forması', value: 'Dibçəkdə' },
      { label: 'Mövcudluq', value: 'Satışda' },
      { label: 'Çatdırılma', value: 'Bakı və Abşeron' },
      { label: 'Satıcı növü', value: 'Tingçilik təsərrüfatı' },
    ],
    description: [
      'Sağlam və formalaşmış zeytun ağacları satışdadır. Hündürlüyü dibçək daxil olmaqla 180–200 sm-dir. Ağaclar Abşeron iqliminə uyğunlaşdırılıb və açıq sahədə yetişdirilib. Bağ, həyət və terrasların yaşıllaşdırılması üçün uyğundur.',
      'Bitkiləri təsərrüfatımızda yerində görə bilərsiniz. Bakı və Abşerona çatdırılma ayrıca razılaşdırılır. Əkin və ilkin qulluq barədə məsləhət veririk. Digər ölçülər üçün bizimlə əlaqə saxlayın.',
    ],
  },
  {
    id: 'mavi-kuknar',
    slug: 'mavi-kuknar-picea-pungens',
    title: 'Mavi küknar — Picea pungens',
    price: 85,
    attributes: ['100–120 sm', '3 yaş'],
    cityId: 'baki',
    publishedAt: '2026-10-12T08:55:00',
    vip: true,
    categoryId: 'agaclar',
    subcategory: 'Dekorativ ağaclar',
    cover: img('mavi-kuknar-1'),
    images: [img('mavi-kuknar-1'), img('mavi-kuknar-4'), img('mavi-kuknar-5'), img('mavi-kuknar-2'), img('mavi-kuknar-3')],
    deliveryAvailable: true,
    status: 'active',
  },
  {
    id: 'yapon-agcaqayini',
    slug: 'yapon-agcaqayini',
    title: 'Yapon ağcaqayını',
    price: 120,
    attributes: ['120 sm', '4 yaş', 'qırmızı yarpaq'],
    cityId: 'quba',
    publishedAt: '2026-10-12T08:50:00',
    vip: true,
    categoryId: 'agaclar',
    cover: img('yapon-agcaqayini-1'),
    images: [img('yapon-agcaqayini-1'), img('yapon-agcaqayini-4'), img('yapon-agcaqayini-2'), img('yapon-agcaqayini-3')],
    status: 'active',
  },
  {
    id: 'limon-agaci',
    slug: 'limon-agaci',
    title: 'Limon ağacı',
    price: 65,
    attributes: ['80–100 sm', 'meyvəli'],
    cityId: 'lenkeran',
    publishedAt: '2026-10-12T12:00:00',
    vip: false,
    categoryId: 'agaclar',
    cover: img('limon-agaci-1'),
    images: [img('limon-agaci-1'), img('limon-agaci-2'), img('limon-agaci-3')],
    status: 'active',
  },
  {
    id: 'leyland-servi',
    slug: 'leyland-servi',
    title: 'Leyland sərvi',
    price: 38,
    attributes: ['100–120 sm', 'həmişəyaşıl'],
    cityId: 'sumqayit',
    publishedAt: '2026-10-12T11:55:00',
    vip: false,
    categoryId: 'agaclar',
    cover: img('leyland-servi-1'),
    images: [img('leyland-servi-1'), img('leyland-servi-2'), img('leyland-servi-3')],
    status: 'active',
  },
  {
    id: 'qizilgul-fidani',
    slug: 'qizilgul-fidani',
    title: 'Qızılgül fidanı',
    price: 12,
    attributes: ['40–60 sm', 'çəhrayı', 'dibçəkdə'],
    cityId: 'gence',
    publishedAt: '2026-10-12T11:50:00',
    vip: false,
    categoryId: 'guller',
    cover: img('qizilgul-fidani-1'),
    images: [img('qizilgul-fidani-1'), img('qizilgul-fidani-2'), img('qizilgul-fidani-3')],
    status: 'active',
  },
  {
    id: 'monstera-deliciosa',
    slug: 'monstera-deliciosa',
    title: 'Monstera deliciosa',
    price: 45,
    attributes: ['60–80 sm', 'otaq bitkisi'],
    cityId: 'baki',
    publishedAt: '2026-10-12T11:45:00',
    vip: false,
    categoryId: 'dekorativ-bitkiler',
    cover: img('monstera-deliciosa-1'),
    images: [img('monstera-deliciosa-1'), img('monstera-deliciosa-2'), img('monstera-deliciosa-3')],
    status: 'active',
  },
  {
    id: 'alma-fidani',
    slug: 'meyve-bagi-ucun-alma-fidani',
    title: 'Meyvə bağı üçün alma fidanı',
    price: 9,
    attributes: ['2 yaş', 'Golden Delicious'],
    cityId: 'seki',
    publishedAt: '2026-10-12T11:40:00',
    vip: false,
    categoryId: 'tingler-fidanlar',
    cover: img('alma-fidani-1'),
    images: [img('alma-fidani-1'), img('alma-fidani-2'), img('alma-fidani-3')],
    status: 'active',
  },
  {
    id: 'terrakota-dibcek',
    slug: 'terrakota-dibcek',
    title: 'Terrakota dibçək',
    price: 28,
    attributes: ['Ø 35 sm', 'təbii gil'],
    cityId: 'baki',
    publishedAt: '2026-10-12T11:35:00',
    vip: false,
    categoryId: 'dibcekler-dekorasiya',
    cover: img('terrakota-dibcek-1'),
    images: [img('terrakota-dibcek-1'), img('terrakota-dibcek-2'), img('terrakota-dibcek-3')],
    status: 'active',
  },
  {
    id: 'torpaq-qarisigi',
    slug: 'bag-ucun-torpaq-qarisigi',
    title: 'Bağ üçün torpaq qarışığı',
    price: 8,
    attributes: ['20 litr', 'üzvi qarışıq'],
    cityId: 'abseron',
    publishedAt: '2026-10-12T11:30:00',
    vip: false,
    categoryId: 'torpaq-gubreler',
    sellerId: 'abseron-tingcilik',
    cover: img('torpaq-qarisigi-1'),
    images: [img('torpaq-qarisigi-1'), img('torpaq-qarisigi-4'), img('torpaq-qarisigi-2'), img('torpaq-qarisigi-3')],
    status: 'active',
  },
  {
    id: 'tuya-smaragd',
    slug: 'tuya-smaragd',
    number: 10362,
    title: 'Tuya — Smaragd',
    price: 55,
    attributes: ['140 sm', '3 yaş', 'dibçəkdə'],
    cityId: 'abseron',
    publishedAt: '2026-10-12T08:47:00',
    vip: false,
    categoryId: 'agaclar',
    subcategory: 'Dekorativ ağaclar',
    sellerId: 'abseron-tingcilik',
    cover: img('tuya-smaragd-1'),
    thumbnail: '/images/dashboard/my-listing-2.webp',
    images: [img('tuya-smaragd-1'), img('tuya-smaragd-2'), '/images/dashboard/my-listing-2.webp'],
    deliveryAvailable: true,
    status: 'active',
    views: 176,
  },
  {
    id: 'defne-agaci',
    slug: 'defne-agaci',
    title: 'Dəfnə ağacı',
    price: 48,
    attributes: ['90 sm', '3 yaş', 'həmişəyaşıl'],
    cityId: 'abseron',
    publishedAt: '2026-10-12T08:35:00',
    vip: false,
    categoryId: 'agaclar',
    subcategory: 'Dekorativ ağaclar',
    sellerId: 'abseron-tingcilik',
    cover: img('defne-agaci-1'),
    images: [img('defne-agaci-1'), img('defne-agaci-2')],
    deliveryAvailable: true,
    status: 'active',
  },
  {
    id: 'nar-fidani',
    slug: 'nar-fidani-guleyse',
    title: 'Nar fidanı — Güleyşə',
    price: 15,
    attributes: ['80 sm', '2 yaş'],
    cityId: 'abseron',
    publishedAt: '2026-10-12T08:30:00',
    vip: false,
    categoryId: 'tingler-fidanlar',
    sellerId: 'abseron-tingcilik',
    cover: img('nar-fidani-1'),
    images: [img('nar-fidani-1')],
    status: 'active',
  },
  {
    id: 'uzvi-kompost',
    slug: 'uzvi-kompost',
    title: 'Üzvi kompost',
    price: 10,
    attributes: ['25 litr', 'ələnmiş'],
    cityId: 'abseron',
    publishedAt: '2026-10-12T08:25:00',
    vip: false,
    categoryId: 'torpaq-gubreler',
    sellerId: 'abseron-tingcilik',
    cover: img('uzvi-kompost-1'),
    images: [img('uzvi-kompost-1')],
    status: 'active',
  },
  {
    id: 'italyan-sami',
    slug: 'italyan-sami',
    title: 'İtalyan şamı',
    price: 160,
    attributes: ['200 sm', '5 yaş'],
    cityId: 'baki',
    publishedAt: '2026-10-12T08:45:00',
    vip: false,
    categoryId: 'agaclar',
    subcategory: 'Dekorativ ağaclar',
    cover: img('italyan-sami-1'),
    images: [img('italyan-sami-1')],
    deliveryAvailable: true,
    status: 'active',
  },
  {
    id: 'qaracohre',
    slug: 'qaracohre-taxus-baccata',
    title: 'Qaraçöhrə — Taxus baccata',
    price: 72,
    attributes: ['100 sm', '3 yaş', 'dibçəkdə'],
    cityId: 'baki',
    publishedAt: '2026-10-12T08:48:00',
    vip: false,
    categoryId: 'agaclar',
    subcategory: 'Dekorativ ağaclar',
    cover: img('qaracohre-1'),
    images: [img('qaracohre-1')],
    deliveryAvailable: true,
    status: 'active',
  },
  /* ---- The signed-in seller's own listings that are not public (Figma "Şəxsi kabinet", wizard, moderation) ---- */
  {
    id: 'leyland-servi-120',
    slug: 'leyland-servi-120-sm',
    number: 10524,
    title: 'Leyland sərvi — 120 sm',
    price: 38,
    attributes: ['120 sm'],
    cityId: 'abseron',
    publishedAt: '2026-10-12T13:00:00',
    vip: false,
    categoryId: 'agaclar',
    sellerId: 'abseron-tingcilik',
    cover: '/images/post-ad/upload-1.webp',
    thumbnail: '/images/dashboard/my-listing-3.webp',
    images: [
      '/images/post-ad/upload-1.webp',
      '/images/post-ad/upload-2.webp',
      '/images/post-ad/upload-3.webp',
      '/images/post-ad/preview.webp',
      '/images/admin/moderation-leyland.webp',
      '/images/post-ad/submitted.webp',
      '/images/dashboard/my-listing-3.webp',
    ],
    status: 'pending',
  },
  {
    id: 'lavanda-fidani',
    slug: 'lavanda-fidani',
    number: 10118,
    title: 'Lavanda fidanı',
    price: 7,
    attributes: [],
    cityId: 'abseron',
    publishedAt: '2026-09-12T10:00:00',
    vip: false,
    categoryId: 'tingler-fidanlar',
    sellerId: 'abseron-tingcilik',
    cover: '/images/dashboard/my-listing-4.webp',
    thumbnail: '/images/dashboard/my-listing-4.webp',
    images: ['/images/dashboard/my-listing-4.webp'],
    status: 'expired',
    views: 92,
  },
]

/** Listings visible to buyers (search, home, seller page). */
export const publicListings = listings.filter((l) => l.status === 'active')

/** Home "VIP elanlar" order (Figma columns 1 → 3). */
export const vipListingIds = ['zeytun-agaci', 'mavi-kuknar', 'yapon-agcaqayini']

/** Home "Son elanlar" order (Figma rows/columns, 7 cards). */
export const latestListingIds = [
  'limon-agaci',
  'leyland-servi',
  'qizilgul-fidani',
  'monstera-deliciosa',
  'alma-fidani',
  'terrakota-dibcek',
  'torpaq-qarisigi',
]

const byId = new Map(listings.map((l) => [l.id, l]))

export function listingById(id: string): Listing | undefined {
  return byId.get(id)
}

export function listingBySlug(slug: string): Listing | undefined {
  return listings.find((l) => l.slug === slug)
}

export function listingsByIds(ids: string[]): Listing[] {
  return ids.map((id) => byId.get(id)).filter((l): l is Listing => Boolean(l))
}

/** Parses the height range written in the attribute line ("180–200 sm" → [180, 200], "140 sm" → [140, 140]). */
export function heightRange(listing: Listing): [number, number] | undefined {
  for (const a of listing.attributes) {
    const m = a.match(/^(\d+)(?:–(\d+))?\s*sm$/)
    if (m) return [Number(m[1]), Number(m[2] ?? m[1])]
  }
  return undefined
}

/** Parses the age written in the attribute line ("5 yaş" → 5). */
export function ageYears(listing: Listing): number | undefined {
  for (const a of listing.attributes) {
    const m = a.match(/^(\d+)\s*yaş$/)
    if (m) return Number(m[1])
  }
  return undefined
}
