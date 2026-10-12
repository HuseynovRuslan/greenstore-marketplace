import type { SelectOption } from '@/components/ui/Field'
import { categories, productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { serviceCategories } from '@/data/services'

/*
 * "Elan yerləşdir" wizard data — Figma frames "Elan yerləşdir · 1 … 6" and "Elan yoxlamaya göndərildi".
 * The example draft copies every value shown in the frames; select options come from Figma where the file
 * lists them (subcategories → "İdarəetmə · Kateqoriyalar", seller kinds → "Qeydiyyat", plant names → listings).
 */

export type AdKind = 'product' | 'service'
export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6

export const POST_AD_STEPS: Array<{ number: StepNumber; title: string }> = [
  { number: 1, title: 'Məhsul və ya xidmət seçimi' },
  { number: 2, title: 'Kateqoriya və xüsusiyyətlər' },
  { number: 3, title: 'Şəkillər və təsvir' },
  { number: 4, title: 'Qiymət və yerləşmə' },
  { number: 5, title: 'Əlaqə məlumatları' },
  { number: 6, title: 'Önizləmə və dərc' },
]
export const STEP_COUNT = POST_AD_STEPS.length

/** Figma: "JPG, PNG · hər şəkil maksimum 10 MB · 3/10 şəkil əlavə edilib" */
export const MAX_PHOTOS = 10
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
/** Figma: "22/80 simvol" */
export const TITLE_MAX = 80

export interface DraftPhoto {
  id: string
  /** Public path or a `blob:` object URL for files picked in this browser session */
  url: string
  name: string
}

/** One typed draft for both product and service ads (service-only fields are prefixed accordingly). */
export interface PostAdDraft {
  /* 1 · Məhsul və ya xidmət seçimi */
  kind: AdKind | ''
  /* 2 · Kateqoriya və xüsusiyyətlər (product) */
  categoryId: string
  subcategory: string
  plantType: string
  growingForm: string
  /** cm, as typed */
  height: string
  /** years, as typed */
  age: string
  availability: string
  sellerKind: string
  /** Optional "min–max" range, e.g. "100–120" */
  heightRange: string
  /* 2 · service variant ("Xidmətlərdə iş növü və xidmət ərazisi göstərilir.") */
  serviceType: string
  serviceArea: string
  /* 3 · Şəkillər və təsvir */
  photos: DraftPhoto[]
  coverId: string
  title: string
  description: string
  /* 4 · Qiymət və yerləşmə */
  price: string
  priceUnit: string
  /** Service price form: "başlayan" or "razılaşma yolu ilə" (Figma notice on step 4) */
  servicePriceType: 'from' | 'agreement'
  negotiable: boolean
  cityId: string
  village: string
  address: string
  delivery: boolean
  deliveryAreas: string
  /* 5 · Əlaqə məlumatları */
  sellerName: string
  contactPerson: string
  phone: string
  whatsapp: boolean
  contactHours: string
  showPhone: boolean
  /* 6 · Önizləmə və dərc */
  rulesAccepted: boolean
}

/** Product categories whose ads describe a living plant (type, growing form, height, age). */
export const PLANT_CATEGORY_IDS = ['agaclar', 'dekorativ-bitkiler', 'guller', 'tingler-fidanlar']
export const SERVICE_CATEGORY_ID = 'landsaft-xidmetleri'

/** Alt kateqoriyalar — Figma "İdarəetmə · Kateqoriyalar" rows. */
export const subcategoriesByCategory: Record<string, string[]> = {
  agaclar: ['Dekorativ ağaclar', 'Meyvə ağacları', 'İynəyarpaqlılar'],
  'dekorativ-bitkiler': ['Otaq bitkiləri', 'Kollar', 'Sarmaşıqlar'],
  guller: ['Qızılgüllər', 'Mövsümi güllər', 'Çoxillik güllər'],
  'tingler-fidanlar': ['Meyvə fidanları', 'Üzüm tingləri', 'Giləmeyvə tingləri'],
  'cim-toxumlar': ['Rulon çim', 'Çim toxumu', 'Çiçək toxumu'],
  'torpaq-gubreler': ['Torpaq qarışıqları', 'Kompost', 'Mineral gübrələr'],
  'dibcekler-dekorasiya': ['Dibçəklər', 'Bağ dekoru', 'Çiçək qutuları'],
  'suvarma-sistemleri': ['Damcı suvarma', 'Çiləyicilər', 'İdarəedicilər'],
  'bag-avadanliqlari': ['Əl alətləri', 'Çim biçənlər', 'Bağ qayçıları'],
}

/** Bitki növü — plant names used by the listings in the Figma file, per category, plus "Digər". */
export const plantTypesByCategory: Record<string, string[]> = {
  agaclar: [
    'Leyland sərvi',
    'Zeytun ağacı',
    'Mavi küknar',
    'Tuya',
    'Yapon ağcaqayını',
    'Limon ağacı',
    'Dəfnə ağacı',
    'İtalyan şamı',
    'Qaraçöhrə',
  ],
  'dekorativ-bitkiler': ['Monstera deliciosa'],
  guller: ['Qızılgül'],
  'tingler-fidanlar': ['Alma fidanı', 'Nar fidanı', 'Lavanda fidanı'],
}
export const OTHER_OPTION = 'Digər'

/** "Dibçəkdə" (Figma) and "açıq sahədə" (Zeytun ağacı description). */
export const growingForms = ['Dibçəkdə', 'Açıq sahədə']
export const availabilityOptions = ['Satışda', 'Sifarişlə']
/** Figma "Qeydiyyat": "Tingçilik təsərrüfatı" + "Bağ mərkəzi və ya landşaft şirkəti də seçə bilərsiniz." */
export const sellerKinds = ['Tingçilik təsərrüfatı', 'Bağ mərkəzi', 'Landşaft şirkəti', 'Fərdi satıcı']

export const priceUnitOptions: SelectOption[] = [
  { value: 'ədəd', label: '1 ədəd üçün' },
  { value: 'kq', label: '1 kq üçün' },
  { value: 'litr', label: '1 litr üçün' },
  { value: 'm²', label: '1 m² üçün' },
]

export const servicePriceTypeOptions: SelectOption[] = [
  { value: 'from', label: 'Başlayan qiymət' },
  { value: 'agreement', label: 'Razılaşma yolu ilə' },
]

const toOptions = (values: string[]): SelectOption[] => values.map((v) => ({ value: v, label: v }))
const placeholder: SelectOption = { value: '', label: 'Seçin' }

/** Prepends a "Seçin" option while nothing is selected (the native select needs a value to show). */
export function withPlaceholder(options: SelectOption[], value: string): SelectOption[] {
  return value ? options : [placeholder, ...options]
}

export const productCategoryOptions: SelectOption[] = productCategories.map((c) => ({ value: c.id, label: c.name }))
export const serviceCategoryOptions: SelectOption[] = categories
  .filter((c) => c.kind === 'service')
  .map((c) => ({ value: c.id, label: c.name }))
export const serviceTypeOptions: SelectOption[] = toOptions(serviceCategories.map((c) => c.name))
export const cityOptions: SelectOption[] = cities.map((c) => ({ value: c.id, label: c.name }))

export function subcategoryOptions(categoryId: string): SelectOption[] {
  return toOptions(subcategoriesByCategory[categoryId] ?? [])
}
export function plantTypeOptions(categoryId: string): SelectOption[] {
  return toOptions([...(plantTypesByCategory[categoryId] ?? []), OTHER_OPTION])
}
export const growingFormOptions = toOptions(growingForms)
export const availabilitySelectOptions = toOptions(availabilityOptions)
export const sellerKindOptions = toOptions(sellerKinds)

/**
 * Figma uses a different render of the cover photo in each frame: the 878×380 hero on step 6 and the
 * 220×200 card on the confirmation screen. Keyed by the uploaded photo's URL.
 */
export const photoVariants: Record<string, { preview: string; card: string }> = {
  '/images/post-ad/upload-1.webp': { preview: '/images/post-ad/preview.webp', card: '/images/post-ad/submitted.webp' },
}

/** The listing shown in the Figma frames ("Leyland sərvi — 120 sm", Elan № 10524). */
export const FIGMA_SUBMITTED_LISTING_ID = 'leyland-servi-120'
/** New ads continue the numbering after the Figma example. */
export const FIRST_LISTING_NUMBER = 10525

/** Draft exactly as it appears in the Figma frames, so every step matches the design out of the box. */
export const exampleDraft: PostAdDraft = {
  kind: 'product',
  categoryId: 'agaclar',
  subcategory: 'Dekorativ ağaclar',
  plantType: 'Leyland sərvi',
  growingForm: 'Dibçəkdə',
  height: '120',
  age: '2',
  availability: 'Satışda',
  sellerKind: 'Tingçilik təsərrüfatı',
  // Step 2 frame shows this value with its validation error ("Maksimum hündürlük minimumdan az ola bilməz.")
  heightRange: '120–100',
  serviceType: '',
  serviceArea: '',
  photos: [
    { id: 'figma-1', url: '/images/post-ad/upload-1.webp', name: 'leyland-servi-1.jpg' },
    { id: 'figma-2', url: '/images/post-ad/upload-2.webp', name: 'leyland-servi-2.jpg' },
    { id: 'figma-3', url: '/images/post-ad/upload-3.webp', name: 'leyland-servi-3.jpg' },
  ],
  coverId: 'figma-1',
  title: 'Leyland sərvi — 120 sm',
  description:
    'Sağlam Leyland sərvi fidanları satışdadır. Hündürlük 120 sm, yaş 2 il. Dibçəkdə yetişdirilib, kök sistemi formalaşıb. Canlı hasar və bağların yaşıllaşdırılması üçün uyğundur. Bakı və Abşerona çatdırılma razılaşma ilə mümkündür. Əkin və qulluq barədə məsləhət veririk.',
  price: '38',
  priceUnit: 'ədəd',
  servicePriceType: 'from',
  negotiable: false,
  cityId: 'abseron',
  village: 'Məhəmmədi',
  address: 'Məhəmmədi qəsəbəsi, tingçilik təsərrüfatı',
  delivery: true,
  deliveryAreas: 'Bakı və Abşeron',
  sellerName: 'Abşeron Tingçilik',
  contactPerson: 'Elvin Əliyev',
  phone: '+994 50 555 12 34',
  whatsapp: true,
  contactHours: 'Hər gün 09:00–18:00',
  showPhone: true,
  rulesAccepted: true,
}

/** A blank draft ("Yeni elan yerləşdir"). Contact fields can be pre-filled from the account by the caller. */
export function createEmptyDraft(contact?: Partial<Pick<PostAdDraft, 'sellerName' | 'contactPerson' | 'phone'>>): PostAdDraft {
  return {
    kind: '',
    categoryId: '',
    subcategory: '',
    plantType: '',
    growingForm: '',
    height: '',
    age: '',
    availability: '',
    sellerKind: '',
    heightRange: '',
    serviceType: '',
    serviceArea: '',
    photos: [],
    coverId: '',
    title: '',
    description: '',
    price: '',
    priceUnit: 'ədəd',
    servicePriceType: 'from',
    negotiable: false,
    cityId: '',
    village: '',
    address: '',
    delivery: false,
    deliveryAreas: '',
    sellerName: contact?.sellerName ?? '',
    contactPerson: contact?.contactPerson ?? '',
    phone: contact?.phone ?? '',
    whatsapp: false,
    contactHours: '',
    showPhone: false,
    rulesAccepted: false,
  }
}
