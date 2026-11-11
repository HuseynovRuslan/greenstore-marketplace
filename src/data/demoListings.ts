import { normalizeSearch } from '@/lib/format'
import type { Listing, PlantFacts, PriceType } from '@/types'

const img = (file: string) => `/images/listings/${file}.webp`

/*
 * DEMO listings for the November 2026 categories (src/data/categories.ts), so that every sub-category has at least
 * two listings and no filter opens an empty page. The plants are management's examples per sub-category (the
 * «Nümunələr» column of docs/data/kateqoriyalar-2026-11.xlsx was mostly empty); prices, sizes, sellers and contacts
 * are sample data. Listed in docs/handoff/categories.md → «Demo elanlar», waiting for management to confirm.
 *
 * Photos: none of the Figma photos shows these plants, so each listing has its category's neutral placeholder (the
 * category's Lucide icon on mint, 926 × 500, no photo of a real plant or place).
 *
 * Dates are 4–11 October 2026, before the Figma listings (12 October), so the photographed listings stay first under
 * «Ən yenilər» and in «Son elanlar».
 */

const placeholder: Record<string, string> = {
  agaclar: img('placeholder-agaclar'),
  kollar: img('placeholder-kollar'),
  guller: img('placeholder-guller'),
  sarmasiqlar: img('placeholder-sarmasiqlar'),
  'yer-ortucu-bitkiler': img('placeholder-yer-ortucu-bitkiler'),
}

const rootLabel: Record<NonNullable<PlantFacts['rootSystem']>, string> = { container: 'dibçəkdə', rootball: 'torpaq kürəsi ilə', 'bare-root': 'açıq kök' }

/** The card's grey line, worded like the posting form writes it: «150–180 sm · 3 yaş · torpaq kürəsi ilə». */
function cardLine(p: PlantFacts): string[] {
  const h = p.heightCm
  return [h ? (h.max ? `${h.min}–${h.max} sm` : `${h.min} sm`) : '', p.ageYears != null ? `${p.ageYears} yaş` : '', p.rootSystem ? rootLabel[p.rootSystem] : ''].filter(Boolean)
}

const slug = (title: string) =>
  normalizeSearch(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

interface DemoSpec {
  id: string
  title: string
  price: number
  categoryId: string
  subcategory: string
  cityId: string
  /** Month-day and time in 2026, e.g. "10-11T16:00" */
  at: string
  plant: PlantFacts
  sellerId?: string
  /** An individual seller (no seller page) */
  contact?: [name: string, phone: string]
  priceType?: PriceType
  deliveryAreas?: string
  planting?: boolean
}

const spring = [3, 4, 5]
const springAutumn = [3, 4, 10, 11]

/* Sellers with a page: Yaşıl Bağ Mərkəzi (Bakı) and Quba Fidan (Quba). The rest are individuals. */
const ybm = { sellerId: 'yasil-bag-merkezi', deliveryAreas: 'Bakı daxilində' }
const quba = { sellerId: 'quba-fidan', deliveryAreas: 'Bütün Azərbaycan' }

const specs: DemoSpec[] = [
  /* ---- Ağaclar ---- */
  {
    id: 'cinar',
    title: 'Çinar — Platanus orientalis',
    price: 89,
    categoryId: 'agaclar',
    subcategory: 'Enliyarpaqlı yarpaqtökən ağaclar',
    cityId: 'quba',
    at: '10-11T16:00',
    plant: { species: 'Platanus orientalis', heightCm: { min: 250, max: 300 }, ageYears: 5, rootSystem: 'rootball', sun: 'full-sun', water: 'medium', frostHardinessC: -25, foliage: 'deciduous', plantingMonths: springAutumn },
    ...quba,
    planting: true,
  },
  {
    id: 'coke',
    title: 'Cökə — Tilia cordata',
    price: 75,
    categoryId: 'agaclar',
    subcategory: 'Enliyarpaqlı yarpaqtökən ağaclar',
    cityId: 'quba',
    at: '10-09T16:00',
    plant: { species: 'Tilia cordata', heightCm: { min: 200, max: 250 }, ageYears: 4, rootSystem: 'bare-root', sun: 'part-shade', water: 'medium', frostHardinessC: -35, foliage: 'deciduous', plantingMonths: springAutumn },
    ...quba,
  },
  {
    id: 'sabalid',
    title: 'Şabalıd — Castanea sativa',
    price: 60,
    categoryId: 'agaclar',
    subcategory: 'Enliyarpaqlı yarpaqtökən ağaclar',
    cityId: 'seki',
    at: '10-07T16:00',
    plant: { species: 'Castanea sativa', heightCm: { min: 150, max: 180 }, ageYears: 3, rootSystem: 'rootball', sun: 'full-sun', water: 'medium', frostHardinessC: -20, foliage: 'deciduous', plantingMonths: [3, 4, 10] },
    contact: ['Elçin', '+994 50 712 40 18'],
  },
  {
    id: 'maqnoliya',
    title: 'Maqnoliya — Magnolia grandiflora',
    price: 180,
    priceType: 'negotiable',
    categoryId: 'agaclar',
    subcategory: 'Enliyarpaqlı həmişəyaşıl ağaclar',
    cityId: 'lenkeran',
    at: '10-10T16:00',
    plant: { species: 'Magnolia grandiflora', heightCm: { min: 150, max: 170 }, ageYears: 5, rootSystem: 'container', potLitres: 45, sun: 'full-sun', water: 'medium', frostHardinessC: -15, foliage: 'evergreen', plantingMonths: [4, 5, 9, 10] },
    contact: ['Fərid', '+994 51 604 28 75'],
  },
  {
    id: 'das-palid',
    title: 'Daş palıd — Quercus ilex',
    price: 140,
    categoryId: 'agaclar',
    subcategory: 'Enliyarpaqlı həmişəyaşıl ağaclar',
    cityId: 'baki',
    at: '10-08T16:00',
    plant: { species: 'Quercus ilex', heightCm: { min: 180, max: 200 }, ageYears: 6, rootSystem: 'rootball', sun: 'full-sun', water: 'low', frostHardinessC: -15, foliage: 'evergreen', plantingMonths: springAutumn },
    ...ybm,
    planting: true,
  },

  /* ---- Kollar ---- */
  {
    id: 'berberis',
    title: "Bərbəris — Berberis thunbergii 'Atropurpurea'",
    price: 14,
    categoryId: 'kollar',
    subcategory: 'Yarpaqtökən kollar',
    cityId: 'quba',
    at: '10-11T15:00',
    plant: { species: "Berberis thunbergii 'Atropurpurea'", heightCm: { min: 40, max: 60 }, ageYears: 2, rootSystem: 'container', potLitres: 5, sun: 'full-sun', water: 'low', frostHardinessC: -30, foliage: 'deciduous', plantingMonths: springAutumn },
    ...quba,
  },
  {
    id: 'hortenziya',
    title: 'Hortenziya — Hydrangea macrophylla',
    price: 35,
    categoryId: 'kollar',
    subcategory: 'Yarpaqtökən kollar',
    cityId: 'baki',
    at: '10-10T15:00',
    plant: { species: 'Hydrangea macrophylla', heightCm: { min: 50, max: 70 }, ageYears: 3, rootSystem: 'container', potLitres: 10, sun: 'part-shade', water: 'high', frostHardinessC: -15, foliage: 'deciduous', plantingMonths: [3, 4, 5, 9, 10] },
    ...ybm,
  },
  {
    id: 'spireya',
    title: 'Spireya — Spiraea × vanhouttei',
    price: 12,
    categoryId: 'kollar',
    subcategory: 'Yarpaqtökən kollar',
    cityId: 'gence',
    at: '10-07T15:00',
    plant: { species: 'Spiraea × vanhouttei', heightCm: { min: 60, max: 80 }, ageYears: 2, rootSystem: 'bare-root', sun: 'full-sun', water: 'medium', frostHardinessC: -30, foliage: 'deciduous', plantingMonths: springAutumn },
    contact: ['Nərgiz', '+994 55 238 61 90'],
  },
  {
    id: 'yasemen',
    title: 'Yasəmən — Syringa vulgaris',
    price: 22,
    categoryId: 'kollar',
    subcategory: 'Yarpaqtökən kollar',
    cityId: 'seki',
    at: '10-06T15:00',
    plant: { species: 'Syringa vulgaris', heightCm: { min: 80, max: 100 }, ageYears: 3, rootSystem: 'rootball', sun: 'full-sun', water: 'medium', frostHardinessC: -35, foliage: 'deciduous', plantingMonths: springAutumn },
    contact: ['Səbinə', '+994 70 512 83 46'],
  },
  {
    id: 'sumsad',
    title: 'Şümşad — Buxus sempervirens',
    price: 18,
    categoryId: 'kollar',
    subcategory: 'Həmişəyaşıl kollar',
    cityId: 'sumqayit',
    at: '10-09T15:00',
    plant: { species: 'Buxus sempervirens', heightCm: { min: 30, max: 40 }, ageYears: 3, rootSystem: 'rootball', sun: 'part-shade', water: 'medium', frostHardinessC: -20, foliage: 'evergreen', plantingMonths: springAutumn },
    contact: ['Vüqar', '+994 50 391 07 64'],
  },
  {
    id: 'fotiniya',
    title: "Fotiniya — Photinia × fraseri 'Red Robin'",
    price: 25,
    categoryId: 'kollar',
    subcategory: 'Həmişəyaşıl kollar',
    cityId: 'baki',
    at: '10-08T15:00',
    plant: { species: "Photinia × fraseri 'Red Robin'", heightCm: { min: 80, max: 100 }, ageYears: 3, rootSystem: 'container', potLitres: 10, sun: 'full-sun', water: 'medium', frostHardinessC: -15, foliage: 'evergreen', plantingMonths: springAutumn },
    ...ybm,
  },
  {
    id: 'lavanda',
    title: 'Lavanda — Lavandula angustifolia',
    price: 6,
    categoryId: 'kollar',
    subcategory: 'Həmişəyaşıl kollar',
    cityId: 'abseron',
    at: '10-05T15:00',
    plant: { species: 'Lavandula angustifolia', heightCm: { min: 25, max: 35 }, ageYears: 2, rootSystem: 'container', potLitres: 2, sun: 'full-sun', water: 'low', frostHardinessC: -20, foliage: 'evergreen', plantingMonths: [3, 4, 5, 9, 10] },
    contact: ['Aynur', '+994 70 455 19 62'],
  },

  /* ---- Güllər ---- */
  {
    id: 'petuniya',
    title: 'Petuniya — Petunia × hybrida',
    price: 2,
    categoryId: 'guller',
    subcategory: 'Mövsümi güllər',
    cityId: 'baki',
    at: '10-11T14:00',
    plant: { species: 'Petunia × hybrida', heightCm: { min: 20, max: 25 }, rootSystem: 'container', potLitres: 0.5, sun: 'full-sun', water: 'medium', frostHardinessC: 2, plantingMonths: [4, 5] },
    ...ybm,
  },
  {
    id: 'benovse',
    title: 'Bənövşə — Viola × wittrockiana',
    price: 2,
    categoryId: 'guller',
    subcategory: 'Mövsümi güllər',
    cityId: 'gence',
    at: '10-09T14:00',
    plant: { species: 'Viola × wittrockiana', heightCm: { min: 15, max: 20 }, rootSystem: 'container', potLitres: 0.5, sun: 'part-shade', water: 'medium', frostHardinessC: -15, plantingMonths: [3, 4, 9, 10] },
    contact: ['Gəncə Gül Evi', '+994 22 256 40 11'],
  },
  {
    id: 'mexmergul',
    title: 'Məxmərgül — Tagetes patula',
    price: 2,
    categoryId: 'guller',
    subcategory: 'Mövsümi güllər',
    cityId: 'sumqayit',
    at: '10-08T14:00',
    plant: { species: 'Tagetes patula', heightCm: { min: 20, max: 30 }, rootSystem: 'container', potLitres: 0.5, sun: 'full-sun', water: 'low', frostHardinessC: 0, plantingMonths: [4, 5, 6] },
    contact: ['Vüqar', '+994 50 391 07 64'],
  },
  {
    id: 'begoniya',
    title: 'Begoniya — Begonia semperflorens',
    price: 3,
    categoryId: 'guller',
    subcategory: 'Mövsümi güllər',
    cityId: 'baki',
    at: '10-07T14:00',
    plant: { species: 'Begonia semperflorens', heightCm: { min: 15, max: 20 }, rootSystem: 'container', potLitres: 0.5, sun: 'part-shade', water: 'medium', frostHardinessC: 2, plantingMonths: [5, 6] },
    ...ybm,
  },
  {
    id: 'saqayiq',
    title: 'Şaqayıq — Paeonia lactiflora',
    price: 15,
    categoryId: 'guller',
    subcategory: 'Çoxillik güllər',
    cityId: 'quba',
    at: '10-10T14:00',
    plant: { species: 'Paeonia lactiflora', heightCm: { min: 60, max: 80 }, ageYears: 3, rootSystem: 'bare-root', sun: 'full-sun', water: 'medium', frostHardinessC: -35, plantingMonths: [9, 10] },
    ...quba,
  },
  {
    id: 'zanbaq',
    title: 'Zanbaq — Lilium regale',
    price: 4,
    categoryId: 'guller',
    subcategory: 'Çoxillik güllər',
    cityId: 'lenkeran',
    at: '10-06T14:00',
    plant: { species: 'Lilium regale', heightCm: { min: 80, max: 120 }, rootSystem: 'container', potLitres: 2, sun: 'full-sun', water: 'medium', frostHardinessC: -25, plantingMonths: [3, 4, 10] },
    contact: ['Lalə', '+994 51 330 72 46'],
  },

  /* ---- Sarmaşıqlar ---- */
  {
    id: 'adi-sarmasiq',
    title: 'Adi sarmaşıq — Hedera helix',
    price: 8,
    categoryId: 'sarmasiqlar',
    subcategory: 'Həmişəyaşıl sarmaşıqlar',
    cityId: 'baki',
    at: '10-11T13:00',
    plant: { species: 'Hedera helix', heightCm: { min: 60, max: 80 }, rootSystem: 'container', potLitres: 2, sun: 'shade', water: 'medium', frostHardinessC: -20, foliage: 'evergreen', plantingMonths: [3, 4, 5, 9, 10] },
    ...ybm,
  },
  {
    id: 'ulduz-jasmini',
    title: 'Ulduz jasmini — Trachelospermum jasminoides',
    price: 28,
    categoryId: 'sarmasiqlar',
    subcategory: 'Həmişəyaşıl sarmaşıqlar',
    cityId: 'abseron',
    at: '10-07T13:00',
    plant: { species: 'Trachelospermum jasminoides', heightCm: { min: 100, max: 120 }, ageYears: 2, rootSystem: 'container', potLitres: 5, sun: 'full-sun', water: 'medium', frostHardinessC: -10, foliage: 'evergreen', plantingMonths: [4, 5, 9] },
    contact: ['Aynur', '+994 70 455 19 62'],
  },
  {
    id: 'bugenvilleya',
    title: 'Bugenvilleya — Bougainvillea glabra',
    price: 35,
    categoryId: 'sarmasiqlar',
    subcategory: 'Çiçəkli sarmaşıqlar',
    cityId: 'lenkeran',
    at: '10-10T13:00',
    plant: { species: 'Bougainvillea glabra', heightCm: { min: 80, max: 100 }, ageYears: 2, rootSystem: 'container', potLitres: 5, sun: 'full-sun', water: 'low', frostHardinessC: -1, foliage: 'evergreen', plantingMonths: [4, 5] },
    contact: ['Lalə', '+994 51 330 72 46'],
  },
  {
    id: 'vistariya',
    title: 'Vistariya — Wisteria sinensis',
    price: 45,
    categoryId: 'sarmasiqlar',
    subcategory: 'Çiçəkli sarmaşıqlar',
    cityId: 'gence',
    at: '10-09T13:00',
    plant: { species: 'Wisteria sinensis', heightCm: { min: 150, max: 200 }, ageYears: 4, rootSystem: 'container', potLitres: 10, sun: 'full-sun', water: 'medium', frostHardinessC: -25, foliage: 'deciduous', plantingMonths: [3, 4, 10] },
    contact: ['Nərgiz', '+994 55 238 61 90'],
  },
  {
    id: 'klematis',
    title: 'Klematis — Clematis × jackmanii',
    price: 18,
    categoryId: 'sarmasiqlar',
    subcategory: 'Çiçəkli sarmaşıqlar',
    cityId: 'baki',
    at: '10-06T13:00',
    plant: { species: 'Clematis × jackmanii', heightCm: { min: 60, max: 80 }, ageYears: 2, rootSystem: 'container', potLitres: 2, sun: 'full-sun', water: 'medium', frostHardinessC: -30, foliage: 'deciduous', plantingMonths: [4, 5, 9] },
    ...ybm,
  },
  {
    id: 'qiz-uzumu',
    title: 'Qız üzümü — Parthenocissus quinquefolia',
    price: 10,
    categoryId: 'sarmasiqlar',
    subcategory: 'Yarpaqtökən sarmaşıqlar',
    cityId: 'sumqayit',
    at: '10-08T13:00',
    plant: { species: 'Parthenocissus quinquefolia', heightCm: { min: 100, max: 150 }, rootSystem: 'container', potLitres: 3, sun: 'part-shade', water: 'low', frostHardinessC: -35, foliage: 'deciduous', plantingMonths: [3, 4, 10] },
    contact: ['Vüqar', '+994 50 391 07 64'],
  },
  {
    id: 'kampsis',
    title: 'Kampsis — Campsis radicans',
    price: 16,
    categoryId: 'sarmasiqlar',
    subcategory: 'Yarpaqtökən sarmaşıqlar',
    cityId: 'seki',
    at: '10-05T13:00',
    plant: { species: 'Campsis radicans', heightCm: { min: 100, max: 120 }, ageYears: 2, rootSystem: 'container', potLitres: 3, sun: 'full-sun', water: 'low', frostHardinessC: -25, foliage: 'deciduous', plantingMonths: spring },
    contact: ['Səbinə', '+994 70 512 83 46'],
  },

  /* ---- Yer örtücü bitkilər ---- */
  {
    id: 'vinka',
    title: 'Vinka — Vinca minor',
    price: 3,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Həmişəyaşıl',
    cityId: 'baki',
    at: '10-11T12:00',
    plant: { species: 'Vinca minor', heightCm: { min: 10, max: 15 }, rootSystem: 'container', potLitres: 0.5, sun: 'shade', water: 'medium', frostHardinessC: -25, foliage: 'evergreen', plantingMonths: springAutumn },
    ...ybm,
  },
  {
    id: 'vinka-variegata',
    title: "Vinka — Vinca major 'Variegata'",
    price: 4,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Həmişəyaşıl',
    cityId: 'quba',
    at: '10-04T12:00',
    plant: { species: "Vinca major 'Variegata'", heightCm: { min: 15, max: 20 }, rootSystem: 'container', potLitres: 1, sun: 'part-shade', water: 'medium', frostHardinessC: -15, foliage: 'evergreen', plantingMonths: springAutumn },
    contact: ['Kamil', '+994 50 818 27 03'],
  },
  {
    id: 'surunen-floks',
    title: 'Sürünən floks — Phlox subulata',
    price: 4,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Çiçəkli',
    cityId: 'gence',
    at: '10-10T12:00',
    plant: { species: 'Phlox subulata', heightCm: { min: 10, max: 15 }, rootSystem: 'container', potLitres: 0.5, sun: 'full-sun', water: 'low', frostHardinessC: -30, foliage: 'evergreen', plantingMonths: [3, 4, 9] },
    contact: ['Nərgiz', '+994 55 238 61 90'],
  },
  {
    id: 'gazaniya',
    title: 'Gazaniya — Gazania rigens',
    price: 3,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Çiçəkli',
    cityId: 'abseron',
    at: '10-05T12:00',
    plant: { species: 'Gazania rigens', heightCm: { min: 20, max: 25 }, rootSystem: 'container', potLitres: 0.5, sun: 'full-sun', water: 'low', frostHardinessC: -5, foliage: 'evergreen', plantingMonths: [4, 5] },
    contact: ['Aynur', '+994 70 455 19 62'],
  },
  {
    id: 'surunen-ardic-blue-chip',
    title: "Sürünən ardıc — Juniperus horizontalis 'Blue Chip'",
    price: 22,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'İynəyarpaqlı',
    cityId: 'quba',
    at: '10-09T12:00',
    plant: { species: "Juniperus horizontalis 'Blue Chip'", heightCm: { min: 15, max: 20 }, ageYears: 3, rootSystem: 'container', potLitres: 3, sun: 'full-sun', water: 'low', frostHardinessC: -35, foliage: 'evergreen', plantingMonths: springAutumn },
    ...quba,
  },
  {
    id: 'surunen-ardic-nana',
    title: "Sürünən ardıc — Juniperus procumbens 'Nana'",
    price: 26,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'İynəyarpaqlı',
    cityId: 'baki',
    at: '10-04T11:00',
    plant: { species: "Juniperus procumbens 'Nana'", heightCm: { min: 20, max: 25 }, ageYears: 4, rootSystem: 'container', potLitres: 5, sun: 'full-sun', water: 'low', frostHardinessC: -30, foliage: 'evergreen', plantingMonths: springAutumn },
    ...ybm,
  },
  {
    id: 'sedum',
    title: 'Sedum — Sedum spurium',
    price: 3,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Sukkulentlər',
    cityId: 'sumqayit',
    at: '10-08T12:00',
    plant: { species: 'Sedum spurium', heightCm: { min: 10, max: 15 }, rootSystem: 'container', potLitres: 0.5, sun: 'full-sun', water: 'low', frostHardinessC: -30, foliage: 'evergreen', plantingMonths: [4, 5, 9] },
    contact: ['Vüqar', '+994 50 391 07 64'],
  },
  {
    id: 'delosperma',
    title: 'Delosperma — Delosperma cooperi',
    price: 4,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Sukkulentlər',
    cityId: 'abseron',
    at: '10-06T12:00',
    plant: { species: 'Delosperma cooperi', heightCm: { min: 5, max: 10 }, rootSystem: 'container', potLitres: 0.5, sun: 'full-sun', water: 'low', frostHardinessC: -15, foliage: 'evergreen', plantingMonths: [4, 5] },
    contact: ['Aynur', '+994 70 455 19 62'],
  },
  {
    id: 'festuka',
    title: 'Festuka — Festuca glauca',
    price: 5,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Ot tipli',
    cityId: 'baki',
    at: '10-07T12:00',
    plant: { species: 'Festuca glauca', heightCm: { min: 20, max: 30 }, rootSystem: 'container', potLitres: 1, sun: 'full-sun', water: 'low', frostHardinessC: -30, foliage: 'evergreen', plantingMonths: springAutumn },
    ...ybm,
  },
  {
    id: 'ofiopoqon',
    title: 'Ofiopoqon — Ophiopogon japonicus',
    price: 6,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Ot tipli',
    cityId: 'lenkeran',
    at: '10-05T12:00',
    plant: { species: 'Ophiopogon japonicus', heightCm: { min: 10, max: 15 }, rootSystem: 'container', potLitres: 1, sun: 'shade', water: 'medium', frostHardinessC: -15, foliage: 'evergreen', plantingMonths: [3, 4, 9, 10] },
    contact: ['Lalə', '+994 51 330 72 46'],
  },
  {
    id: 'lizimaxiya',
    title: "Lizimaxiya — Lysimachia nummularia 'Aurea'",
    price: 3,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Sürünən yarpaqlı',
    cityId: 'quba',
    at: '10-06T11:00',
    plant: { species: "Lysimachia nummularia 'Aurea'", heightCm: { min: 5, max: 10 }, rootSystem: 'container', potLitres: 0.5, sun: 'part-shade', water: 'high', frostHardinessC: -30, foliage: 'evergreen', plantingMonths: [4, 5, 9] },
    contact: ['Kamil', '+994 50 818 27 03'],
  },
  {
    id: 'dixondra',
    title: "Dixondra — Dichondra argentea 'Silver Falls'",
    price: 4,
    categoryId: 'yer-ortucu-bitkiler',
    subcategory: 'Sürünən yarpaqlı',
    cityId: 'baki',
    at: '10-04T10:00',
    plant: { species: "Dichondra argentea 'Silver Falls'", heightCm: { min: 5, max: 10 }, rootSystem: 'container', potLitres: 0.5, sun: 'full-sun', water: 'medium', frostHardinessC: -3, foliage: 'evergreen', plantingMonths: [4, 5] },
    ...ybm,
  },
]

/** First demo listing number («Elan № 10440»); numbers follow the order above. */
const FIRST_NUMBER = 10440

export const demoListings: Listing[] = specs.map((d, i) => ({
  id: d.id,
  slug: slug(d.title),
  number: FIRST_NUMBER + i,
  title: d.title,
  price: d.price,
  priceType: d.priceType ?? 'fixed',
  priceUnit: 'piece',
  attributes: cardLine(d.plant),
  cityId: d.cityId,
  publishedAt: `2026-${d.at}:00`,
  vip: false,
  categoryId: d.categoryId,
  subcategory: d.subcategory,
  sellerId: d.sellerId,
  cover: placeholder[d.categoryId],
  images: [placeholder[d.categoryId]],
  plant: d.plant,
  deliveryAvailable: Boolean(d.deliveryAreas),
  deliveryAreas: d.deliveryAreas,
  plantingAvailable: d.planting,
  contactName: d.contact?.[0],
  contactPhone: d.contact?.[1],
  whatsapp: true,
  status: 'active',
}))

/** Ids of the demo listings (handoff and tests). */
export const demoListingIds = specs.map((d) => d.id)
