import type { Service, ServiceProvider } from '@/types'

const img = (file: string) => `/images/services/${file}.webp`

/** Service providers named on the Figma service cards ("Xidmətlər", home "Bağınıza peşəkar toxunuş", "Landşaft dizaynı"). */
export const providers: ServiceProvider[] = [
  {
    id: 'yasil-mekan-landsaft',
    name: 'Yaşıl Məkan Landşaft',
    verified: true,
    kind: 'company',
    summary: 'Landşaft şirkəti · 2018-ci ildən fəaliyyət göstərir · Bakı, Nərimanov rayonu',
    workingHours: 'B.e.–Şənbə 09:00–18:00',
  },
  { id: 'aquabag', name: 'AquaBağ', verified: true },
  { id: 'bag-ustasi', name: 'Bağ Ustası', verified: true },
  { id: 'abseron-tingcilik', name: 'Abşeron Tingçilik', verified: true, sellerId: 'abseron-tingcilik', kind: 'company' },
  { id: 'quba-bag', name: 'Quba Bağ', verified: true },
]

/**
 * Service listings — Figma "Xidmətlər · 1440" (6 cards, in grid order) + home showcase + "Landşaft dizaynı" detail.
 * `cover` = photo on the services catalogue card; home showcase photos and detail gallery photos follow in `images`.
 */
export const services: Service[] = [
  {
    id: 'landsaft-dizayni',
    slug: 'landsaft-dizayni-ve-yasillasdirma',
    number: 20316,
    title: 'Landşaft dizaynı və yaşıllaşdırma',
    priceLabel: '25 ₼/m²-dən',
    priceFrom: 25,
    providerId: 'yasil-mekan-landsaft',
    areas: ['Bakı', 'Abşeron', 'Sumqayıt'],
    categoryId: 'landsaft-dizayni',
    cover: img('landsaft-dizayni-4'),
    images: [
      img('landsaft-dizayni-gallery-1'),
      img('landsaft-dizayni-gallery-2'),
      img('landsaft-dizayni-gallery-3'),
      img('landsaft-dizayni-gallery-4'),
      img('landsaft-dizayni-4'),
      img('landsaft-dizayni-1'),
      img('landsaft-dizayni-2'),
      img('landsaft-dizayni-3'),
    ],
    description: [
      'Həyətyanı sahələr, villalar və kommersiya məkanları üçün funksional və uzunömürlü bağlar hazırlayırıq. Hər layihədə sahənin işıqlanmasını, torpaq xüsusiyyətlərini və yerli iqlimi nəzərə alırıq. Layihələndirmədən əkinə qədər bütün mərhələlər bir komanda tərəfindən koordinasiya edilir.',
    ],
    includes: [
      'Sahəyə baxış və ölçülərin götürülməsi',
      'Əkin planı və bitki seçimi',
      '3D landşaft konsepsiyası',
      'Yaşıllaşdırma və çim salınması',
      'Suvarma sisteminin planlaşdırılması',
      'Mövsümi qulluq üzrə tövsiyələr',
    ],
    verified: true,
  },
  {
    id: 'avtomatik-suvarma',
    slug: 'avtomatik-suvarma-qurasdirilmasi',
    title: 'Avtomatik suvarma quraşdırılması',
    homeTitle: 'Avtomatik suvarma sistemləri',
    priceLabel: '350 ₼-dən',
    priceFrom: 350,
    providerId: 'aquabag',
    areas: ['Bakı', 'Abşeron'],
    categoryId: 'avtomatik-suvarma',
    cover: img('avtomatik-suvarma-4'),
    images: [img('avtomatik-suvarma-4'), img('avtomatik-suvarma-1'), img('avtomatik-suvarma-2'), img('avtomatik-suvarma-3')],
    verified: true,
  },
  {
    id: 'cim-salinmasi',
    slug: 'cim-salinmasi-ve-qulluq',
    title: 'Çim salınması və qulluq',
    priceLabel: '8 ₼/m²-dən',
    priceFrom: 8,
    providerId: 'yasil-mekan-landsaft',
    areas: ['Bakı', 'Sumqayıt'],
    categoryId: 'cim-salinmasi',
    cover: img('cim-salinmasi-1'),
    images: [img('cim-salinmasi-1')],
    verified: true,
  },
  {
    id: 'movsumi-bag-baximi',
    slug: 'movsumi-bag-baximi',
    title: 'Mövsümi bağ baxımı',
    priceLabel: '150 ₼-dən',
    priceFrom: 150,
    providerId: 'bag-ustasi',
    areas: ['Bakı', 'Abşeron'],
    categoryId: 'bag-baximi',
    cover: img('movsumi-bag-baximi-4'),
    images: [img('movsumi-bag-baximi-4'), img('movsumi-bag-baximi-1'), img('movsumi-bag-baximi-2'), img('movsumi-bag-baximi-3')],
    verified: true,
  },
  {
    id: 'agac-ekilmesi',
    slug: 'agac-ekilmesi',
    title: 'Ağac əkilməsi',
    priceLabel: 'Razılaşma yolu ilə',
    providerId: 'abseron-tingcilik',
    areas: ['Abşeron', 'Bakı'],
    categoryId: 'agac-ekilmesi',
    cover: img('agac-ekilmesi-1'),
    images: [img('agac-ekilmesi-1')],
    verified: true,
  },
  {
    id: 'heyetyani-yasillasdirma',
    slug: 'heyetyani-sahelerin-yasillasdirilmasi',
    title: 'Həyətyanı sahələrin yaşıllaşdırılması',
    priceLabel: '20 ₼/m²-dən',
    priceFrom: 20,
    providerId: 'quba-bag',
    areas: ['Quba', 'Şəki'],
    categoryId: 'heyetyani-yasillasdirma',
    cover: img('heyetyani-yasillasdirma-1'),
    images: [img('heyetyani-yasillasdirma-1')],
    verified: true,
  },
]

/** Service categories (tiles on "Xidmətlər · 1440", in Figma order). */
export const serviceCategories = [
  { id: 'landsaft-dizayni', name: 'Landşaft dizaynı' },
  { id: 'heyetyani-yasillasdirma', name: 'Həyətyanı sahələrin yaşıllaşdırılması' },
  { id: 'agac-ekilmesi', name: 'Ağac əkilməsi' },
  { id: 'avtomatik-suvarma', name: 'Avtomatik suvarma sistemləri' },
  { id: 'cim-salinmasi', name: 'Çim salınması' },
  { id: 'bag-baximi', name: 'Bağ baxımı' },
]

/** Completed projects ("Tamamlanmış layihələr") on the "Landşaft dizaynı" detail page. */
export const portfolio: Record<string, Array<{ title: string; description: string; image: string }>> = {
  'landsaft-dizayni': [
    { title: 'Mərdəkan · 420 m² həyət', description: 'Landşaft dizaynı, əkin və avtomatik suvarma', image: img('portfolio-merdekan') },
    { title: 'Novxanı · 280 m² bağ', description: 'Çim salınması, istirahət zonası və bitki kompozisiyaları', image: img('portfolio-novxani') },
  ],
}

/**
 * Extra copy that exists in Figma only for some services ("Landşaft dizaynı · 1440"):
 *  - `priceNote`  — text under the price in the price panel
 *  - `process`    — work-process line in "Xidmət əraziləri və iş prosesi"
 */
export const serviceDetails: Record<string, { priceNote?: string; process?: string }> = {
  'landsaft-dizayni': {
    priceNote: 'Başlanğıc qiymət. Yekun təklif sahənin ölçüsünə, layihəyə və seçilən materiallara görə razılaşdırılır.',
    process: 'İlkin əlaqə → sahəyə baxış → fərdi təklif → razılaşdırılmış iş qrafiki. Bölgələrdə iri layihələr ayrıca müzakirə olunur.',
  },
}

/** Home "Bağınıza peşəkar toxunuş" order (Figma columns 1 → 3) and the photo used there. */
export const homeServices: Array<{ id: string; image: string }> = [
  { id: 'landsaft-dizayni', image: img('landsaft-dizayni-1') },
  { id: 'avtomatik-suvarma', image: img('avtomatik-suvarma-1') },
  { id: 'movsumi-bag-baximi', image: img('movsumi-bag-baximi-1') },
]

const providerMap = new Map(providers.map((p) => [p.id, p]))
export function providerById(id: string): ServiceProvider | undefined {
  return providerMap.get(id)
}
export function providerName(id: string): string {
  return providerMap.get(id)?.name ?? ''
}
export function serviceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug)
}
export function serviceById(id: string): Service | undefined {
  return services.find((s) => s.id === id)
}
