import type { OpeningHours, Seller } from '@/types'

const img = (file: string) => `/images/sellers/${file}.webp`

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const
const everyDay = (open: string, close: string): OpeningHours[] => DAYS.map((day) => ({ day, open, close }))
const weekdays = (open: string, close: string): OpeningHours[] => DAYS.slice(0, 5).map((day) => ({ day, open, close }))

/**
 * Sellers from Figma: home "Etibar etdiyiniz satıcılar" (1440/768/390) and the public seller page "Abşeron Tingçilik".
 * Fields not present in the design are left undefined rather than invented.
 */
export const sellers: Seller[] = [
  {
    id: 'abseron-tingcilik',
    slug: 'abseron-tingcilik',
    name: 'Abşeron Tingçilik',
    kind: 'Tingçilik təsərrüfatı',
    type: 'business',
    cityId: 'abseron',
    activeListings: 24,
    verified: true,
    memberSince: 2021,
    image: img('abseron-tingcilik-1'),
    coverImage: img('abseron-tingcilik-cover'),
    phone: '+994 50 555 12 34',
    email: 'info@absheronting.az',
    address: 'Abşeron, Məhəmmədi qəsəbəsi',
    workingHours: 'Hər gün 09:00–18:00',
    contactPerson: 'Elvin Əliyev',
    about:
      'Abşeron iqliminə uyğun dekorativ ağaclar və meyvə fidanları yetişdiririk. Təsərrüfatımızda zeytun, sərv, tuya və mövsümi bitkiləri yerində seçə bilərsiniz. Sağlam kök sistemi və düzgün əkin üzrə məsləhətlərə xüsusi diqqət yetiririk.',
    terms: 'Bakı və Abşerona çatdırılma razılaşma ilə. Hər gün 09:00–18:00. Təsərrüfata gəlməzdən əvvəl əlaqə saxlamağınız tövsiyə olunur.',
    // Nov 2026 contract additions (sample data)
    businessKind: 'nursery',
    hours: everyDay('09:00', '18:00'),
    whatsapp: true,
    instagram: 'absheron.tingcilik',
    location: { lat: 40.5281, lng: 49.9215 },
    offers: ['delivery', 'planting', 'wholesale', 'care'],
    responseMinutes: 60,
    serviceIds: ['agac-ekilmesi'],
  },
  {
    id: 'yasil-bag-merkezi',
    slug: 'yasil-bag-merkezi',
    name: 'Yaşıl Bağ Mərkəzi',
    type: 'business',
    cityId: 'baki',
    activeListings: 38,
    verified: true,
    image: img('yasil-bag-merkezi-1'),
    // Nov 2026 contract additions (sample data)
    kind: 'Bağ mərkəzi',
    businessKind: 'garden-centre',
    memberSince: 2019,
    phone: '+994 12 510 44 20',
    address: 'Bakı, Xətai rayonu, Babək prospekti 42',
    about: 'Otaq bitkiləri, güllər, dibçəklər, torpaq və bağ alətləri bir yerdə. Bitki seçimi və qulluq üzrə pulsuz məsləhət veririk.',
    terms: 'Bakı daxilində 50 ₼-dan yuxarı sifarişlərə çatdırılma pulsuzdur.',
    hours: [...weekdays('10:00', '20:00'), { day: 6, open: '10:00', close: '20:00' }, { day: 7, open: '11:00', close: '18:00' }],
    whatsapp: true,
    offers: ['delivery', 'care'],
    responseMinutes: 30,
  },
  {
    id: 'quba-fidan',
    slug: 'quba-fidan',
    name: 'Quba Fidan',
    type: 'business',
    cityId: 'quba',
    activeListings: 19,
    verified: true,
    image: img('quba-fidan-1'),
    // Nov 2026 contract additions (sample data)
    kind: 'Tingçilik təsərrüfatı',
    businessKind: 'nursery',
    memberSince: 2022,
    phone: '+994 23 335 12 08',
    address: 'Quba rayonu, Qırmızı Qəsəbə yolu',
    about: 'Quba iqlimində yetişdirilmiş alma, armud, gilas və qoz fidanları. Topdan sifarişlər və bağ salınması üzrə məsləhət.',
    terms: 'Fidanlar payızda və yazda açıq köklə, il boyu dibçəkdə satılır.',
    hours: [...weekdays('09:00', '17:00'), { day: 6, open: '09:00', close: '14:00' }, { day: 7, closed: true }],
    offers: ['wholesale', 'delivery'],
    responseMinutes: 180,
  },
]

/** Order used by the home page grid (Figma columns 1 → 3). */
export const featuredSellerIds = ['abseron-tingcilik', 'yasil-bag-merkezi', 'quba-fidan']

const byId = new Map(sellers.map((s) => [s.id, s]))
export function sellerById(id: string | undefined): Seller | undefined {
  return id ? byId.get(id) : undefined
}
export function sellerBySlug(slug: string): Seller | undefined {
  return sellers.find((s) => s.slug === slug)
}
