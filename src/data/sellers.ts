import type { Seller } from '@/types'

const img = (file: string) => `/images/sellers/${file}.webp`

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
