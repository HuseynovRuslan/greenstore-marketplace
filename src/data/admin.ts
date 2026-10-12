import type { IconName } from '@/types'

/**
 * Moderation tools data ("İdarəetmə" frames: Moderasiya, Kateqoriyalar, Şikayətlər · 1440).
 * Strings are copied verbatim from the Figma outlines. Values that the screens need for interactivity but that
 * Figma does not show (rejection reasons, icon labels other than "Ağac", sort label "Əvvəl ən yenilər") are marked.
 */

/* ------------------------------------------------------------------ */
/* Moderasiya                                                           */
/* ------------------------------------------------------------------ */

/** Moderator signed in to the admin tools (header "İdarəetmə · Aysel Həsənova"). */
export const moderatorName = 'Aysel Həsənova'

export type ModerationStatus = 'pending' | 'approved' | 'rejected'

/** "Yoxlamada" = first review, "Təkrar yoxlama" = re-submitted after a rejection. */
export type ModerationKind = 'new' | 'recheck'

export interface ModerationReview {
  /** Large photo on the review panel */
  image?: string
  price?: number
  /** "Ağaclar / Dekorativ ağaclar · 120 sm · 2 yaş · Dibçəkdə · Abşeron, Məhəmmədi" */
  details?: string
  description?: string
  /** Seller line (muted, 13 px) */
  seller?: string
  /** "✓ …" checklist */
  checks?: string[]
}

export interface ModerationItem {
  id: string
  /** "№ 10524" */
  number: number
  title: string
  /** Seller / account name shown in the queue row */
  sellerName: string
  /** Time the listing entered the queue (row shows "12 okt. · 11:32") */
  submittedAt: string
  categoryId: string
  kind: ModerationKind
  status: ModerationStatus
  /** Existing listing in `@/data/listings` this queue item refers to */
  listingId?: string
  review?: ModerationReview
}

/** Figma "Moderasiya növbəsi" (rows in Figma order). */
export const moderationQueue: ModerationItem[] = [
  {
    id: 'mod-10524',
    number: 10524,
    title: 'Leyland sərvi — 120 sm',
    sellerName: 'Abşeron Tingçilik',
    submittedAt: '2026-10-12T11:32:00',
    categoryId: 'agaclar',
    kind: 'new',
    status: 'pending',
    listingId: 'leyland-servi-120',
    review: {
      image: '/images/admin/moderation-leyland.webp',
      price: 38,
      details: 'Ağaclar / Dekorativ ağaclar · 120 sm · 2 yaş · Dibçəkdə · Abşeron, Məhəmmədi',
      description:
        'Sağlam Leyland sərvi fidanları satışdadır. Canlı hasar və bağların yaşıllaşdırılması üçün uyğundur. Bakı və Abşerona çatdırılma razılaşma ilə mümkündür. Əkin və qulluq barədə məsləhət veririk.',
      seller: 'Abşeron Tingçilik · Elvin Əliyev · +994 50 555 12 34 · Təsdiqlənmiş biznes · 24 aktiv elan',
      checks: ['Kateqoriya uyğundur', 'Qiymət göstərilib', 'Əlaqə təsdiqlənib', '3 şəkil əlavə edilib'],
    },
  },
  {
    id: 'mod-10523',
    number: 10523,
    title: 'Qızılgül fidanları',
    sellerName: 'Gəncə Gül Evi',
    submittedAt: '2026-10-12T11:20:00',
    categoryId: 'guller',
    kind: 'new',
    status: 'pending',
    listingId: 'qizilgul-fidani',
  },
  {
    id: 'mod-10522',
    number: 10522,
    title: 'Bağ üçün çim toxumu',
    sellerName: 'Nigar Rzayeva',
    submittedAt: '2026-10-12T10:48:00',
    categoryId: 'cim-toxumlar',
    kind: 'recheck',
    status: 'pending',
  },
]

/**
 * Totals from the Figma header and chips ("12 gözləyən elan · 3 təkrar yoxlama", "Təsdiqlənmiş · 146",
 * "Rədd edilmiş · 8"). They include listings that are not loaded into the visible queue.
 */
export const moderationTotals = { pending: 12, recheck: 3, approved: 146, rejected: 8 }

/** "Sıralama seçin" options. Figma shows "Əvvəl ən köhnələr"; the second label is added for the working sort. */
export const moderationSortOptions = [
  { value: 'newest', label: 'Əvvəl ən yenilər' },
  { value: 'oldest', label: 'Əvvəl ən köhnələr' },
] as const

/** "Səbəb seçin" — Figma shows only the empty value "Səbəb seçilməyib"; reasons mirror the review checklist. */
export const rejectionReasons = [
  'Kateqoriya uyğun deyil',
  'Qiymət düzgün göstərilməyib',
  'Əlaqə məlumatı təsdiqlənməyib',
  'Şəkillər tələblərə uyğun deyil',
  'Təkrar elan',
  'Digər',
]

/* ------------------------------------------------------------------ */
/* Kateqoriyalar                                                        */
/* ------------------------------------------------------------------ */

export interface CategoryFilter {
  id: string
  /** Name in the list row ("Filtrlər: Növ · Hündürlük · Yaş") */
  label: string
  /** Checkbox label in the edit panel ("☑ Ağac növü filtri") */
  formLabel: string
  enabled: boolean
}

export interface CategoryAdminFields {
  subcategories: string[]
  filters: CategoryFilter[]
  /** "Görünmə sırası" */
  order: number
  active: boolean
  /** Order of the filter checkboxes in the edit panel when it differs from the list row (filter ids) */
  formOrder?: string[]
}

const filters = (...items: Array<[id: string, label: string, formLabel?: string]>): CategoryFilter[] =>
  items.map(([id, label, formLabel]) => ({ id, label, formLabel: formLabel ?? `${label} filtri`, enabled: true }))

/** Admin-only fields for `@/data/categories`, keyed by category id (Figma "Kateqoriyalar siyahısı"). */
export const categoryAdminFields: Record<string, CategoryAdminFields> = {
  agaclar: {
    subcategories: ['Dekorativ ağaclar', 'Meyvə ağacları', 'İynəyarpaqlılar'],
    filters: filters(['nov', 'Növ', 'Ağac növü filtri'], ['hundurluk', 'Hündürlük'], ['yas', 'Yaş']),
    formOrder: ['hundurluk', 'yas', 'nov'],
    order: 1,
    active: true,
  },
  'dekorativ-bitkiler': {
    subcategories: ['Otaq bitkiləri', 'Kollar', 'Sarmaşıqlar'],
    filters: filters(['bitki-novu', 'Bitki növü'], ['olcu', 'Ölçü'], ['isiq', 'İşıq tələbi']),
    order: 2,
    active: true,
  },
  guller: {
    subcategories: ['Qızılgüllər', 'Mövsümi güllər', 'Çoxillik güllər'],
    filters: filters(['reng', 'Rəng'], ['ciceklme', 'Çiçəkləmə dövrü']),
    order: 3,
    active: true,
  },
  'tingler-fidanlar': {
    subcategories: ['Meyvə fidanları', 'Üzüm tingləri', 'Giləmeyvə tingləri'],
    filters: filters(['sort', 'Sort'], ['yas', 'Yaş'], ['kok', 'Kök forması']),
    order: 4,
    active: true,
  },
  'cim-toxumlar': {
    subcategories: ['Rulon çim', 'Çim toxumu', 'Çiçək toxumu'],
    filters: filters(['toxum-novu', 'Toxum növü'], ['ceki', 'Çəki'], ['sahe', 'Sahə']),
    order: 5,
    active: true,
  },
  'torpaq-gubreler': {
    subcategories: ['Torpaq qarışıqları', 'Kompost', 'Mineral gübrələr'],
    filters: filters(['terkib', 'Tərkib'], ['hecm', 'Həcm'], ['teyinat', 'Təyinat']),
    order: 6,
    active: true,
  },
  'dibcekler-dekorasiya': {
    subcategories: ['Dibçəklər', 'Bağ dekoru', 'Çiçək qutuları'],
    filters: filters(['material', 'Material'], ['diametr', 'Diametr'], ['hundurluk', 'Hündürlük']),
    order: 7,
    active: true,
  },
  'suvarma-sistemleri': {
    subcategories: ['Damcı suvarma', 'Çiləyicilər', 'İdarəedicilər'],
    filters: filters(['sistem-novu', 'Sistem növü'], ['marka', 'Marka'], ['teyinat', 'Təyinat']),
    order: 8,
    active: true,
  },
  'bag-avadanliqlari': {
    subcategories: ['Əl alətləri', 'Çim biçənlər', 'Bağ qayçıları'],
    filters: filters(['alet-novu', 'Alət növü'], ['marka', 'Marka'], ['veziyyet', 'Vəziyyət']),
    order: 9,
    active: true,
  },
  'landsaft-xidmetleri': {
    subcategories: ['Landşaft dizaynı', 'Əkin', 'Bağ baxımı'],
    filters: filters(['xidmet-novu', 'Xidmət növü'], ['erazi', 'Ərazi'], ['qiymet-formasi', 'Qiymət forması']),
    order: 10,
    active: true,
  },
}

/** "Son yenilənmə: 12 oktyabr 2026" */
export const categoriesUpdatedAt = '2026-10-12'

/** "Kateqoriya işarəsi seçin" labels for the Lucide category icons. Figma shows "Ağac" (trees); the rest are added. */
export const categoryIconLabels: Record<IconName, string> = {
  trees: 'Ağac',
  'flower-2': 'Dekorativ bitki',
  flower: 'Gül',
  sprout: 'Ting',
  wheat: 'Sünbül',
  shovel: 'Kürək',
  amphora: 'Dibçək',
  droplets: 'Su damcıları',
  scissors: 'Bağ qayçısı',
  fence: 'Hasar',
}

/* ------------------------------------------------------------------ */
/* Şikayətlər                                                           */
/* ------------------------------------------------------------------ */

export type ComplaintStatus = 'open' | 'investigating' | 'resolved'

export const complaintStatusLabels: Record<ComplaintStatus, string> = {
  open: 'Açıq',
  investigating: 'Araşdırılır',
  resolved: 'Həll olunub',
}

export interface ComplaintHistoryEntry {
  /** "12 okt. 11:05" */
  time: string
  text: string
}

export interface Complaint {
  id: string
  /** "Ş-184" */
  code: string
  /** Complaint reason / title */
  reason: string
  status: ComplaintStatus
  complainant: string
  /** ISO date ("12 oktyabr 2026") */
  createdAt: string
  /** Reported listing in `@/data/listings` */
  listingId: string
  /** "Elan № 10430" */
  listingNumber: number
  /** Complainant's own words (shown in quotes) */
  message?: string
  /** Photo of the reported listing when Figma has a dedicated one */
  image?: string
  /** Detail line under the price when Figma writes it out ("№ 10430 · Lənkəran · Rauf Məmmədov · …") */
  listingMeta?: string
  /** "Moderator qeydi" */
  note?: string
  history: ComplaintHistoryEntry[]
  /** Closing sentence of "Qərar tarixçəsi" while the complaint is being handled */
  listingNote?: string
}

/** Figma "Şikayət siyahısı" (rows in Figma order). */
export const complaints: Complaint[] = [
  {
    id: 's-184',
    code: 'Ş-184',
    reason: 'Elan məlumatı düzgün deyil',
    status: 'open',
    complainant: 'Aygün Əliyeva',
    createdAt: '2026-10-12',
    listingId: 'limon-agaci',
    listingNumber: 10430,
    message:
      'Elanın hündürlüyü 80–100 sm göstərilib, satıcı ilə əlaqə zamanı daha kiçik ölçü təklif edildi. Məlumatların dəqiqləşdirilməsini xahiş edirəm.',
    image: '/images/admin/complaint.webp',
    listingMeta: '№ 10430 · Lənkəran · Rauf Məmmədov · 80–100 sm · Meyvəli',
    note: 'Satıcıdan cari məhsulun ölçüsünü təsdiqləyən şəkil və məlumat tələb edildi. Cavab gözlənilir.',
    history: [
      { time: '12 okt. 11:05', text: 'Şikayət daxil oldu.' },
      { time: '12 okt. 11:40', text: 'Satıcıya məlumat sorğusu göndərildi.' },
    ],
    listingNote: 'Elan araşdırma müddətində aktivdir.',
  },
  {
    id: 's-183',
    code: 'Ş-183',
    reason: 'Təkrar elan',
    status: 'investigating',
    complainant: 'Kamran İsmayılov',
    createdAt: '2026-10-12',
    listingId: 'qizilgul-fidani',
    listingNumber: 10416,
    history: [],
  },
  {
    id: 's-182',
    code: 'Ş-182',
    reason: 'Uyğun olmayan şəkil',
    status: 'resolved',
    complainant: 'Nərmin Həsənli',
    createdAt: '2026-10-12',
    listingId: 'terrakota-dibcek',
    listingNumber: 10388,
    history: [],
  },
]

/** Totals from the Figma header and chips ("7 açıq şikayət · 2 araşdırılır · 18 həll olunub"). */
export const complaintTotals: Record<ComplaintStatus, number> = { open: 7, investigating: 2, resolved: 18 }
