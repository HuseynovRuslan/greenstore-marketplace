import type { BusinessKind, SavedSearch, UserProfile } from '@/types'

/**
 * Account details shown/edited in "Profil məlumatları" that are not part of the shared `UserProfile` DTO.
 * The mock session (`useSession`) stores the whole object, so these fields survive `updateProfile` patches.
 */
export interface AccountProfile extends UserProfile {
  /** "Şirkətin adı" (empty for individual accounts) */
  companyName?: string
  /** «Biznesin növü»: one or more (business accounts) */
  businessKinds?: BusinessKind[]
  /** "Şəhər seçin" (id from `@/data/cities`) */
  cityId?: string
  /** "Ünvan" */
  address?: string
  /** "Şirkət haqqında" */
  about?: string
  /** "Təsdiqlənmiş biznes hesabı" / "Profiliniz təsdiqlənib" */
  verified?: boolean
  /** "Telefon təsdiqlənib" */
  phoneVerified?: boolean
  /** "Bildiriş seçimləri" */
  notifications?: NotificationSettings
  /*
   * DATA_SOURCE=api: the business profile as the API has it (GET /me/seller), for «İctimai profilə bax» and the
   * profile form. The demo account's come from src/data/sellers instead.
   */
  /** The public page: /saticilar/<sellerSlug> */
  sellerSlug?: string
  /** The profile's card photo; "" when it has none yet */
  sellerImage?: string
  /** `OwnSeller.version`, sent back with a change so another device's newer edit is not overwritten */
  sellerVersion?: string
}

/** The business kinds as the forms name them (src/features/seller/businessKinds.ts keeps their order). */
export const businessKindLabels: Record<BusinessKind, string> = {
  nursery: 'Tingçilik təsərrüfatı',
  'garden-centre': 'Bağ mərkəzi',
  landscaping: 'Landşaft şirkəti',
}

export interface NotificationSettings {
  /** "Elanın moderasiya nəticəsi" */
  moderation: boolean
  /** "Müddətin bitməsi haqqında xəbərdarlıq" */
  expiry: boolean
  /** "Yeniliklər və xüsusi təkliflər" */
  news: boolean
}

/**
 * The demo account's «Seçilmişlər», as if loaded from the server on sign-in (Figma "Seçilmişlər · 390"). Figma had the
 * terracotta pot and the Monstera here; they left with their categories (Nov 2026).
 */
export const DEMO_ACCOUNT_FAVORITES = ['listing:limon-agaci', 'listing:qizilgul-fidani', 'listing:mavi-kuknar', 'listing:zeytun-agaci', 'service:landsaft-dizayni']

/** The demo account's saved searches, so «Axtarışlarım» shows what it looks like. */
export const DEMO_SAVED_SEARCHES: SavedSearch[] = [
  { id: 'ss-demo-1', name: 'Bakıda ağaclar', query: 'kateqoriya=agaclar&seher=baki', alerts: true, createdAt: '2026-10-20T09:00:00', newCount: 3 },
  { id: 'ss-demo-2', name: 'Tuya, 50 ₼-a qədər', query: 'q=tuya&max=50', alerts: false, createdAt: '2026-10-28T18:30:00', newCount: 0 },
]

/**
 * Signed-in demo account (Figma "Şəxsi kabinet", "Profil məlumatları", "Qeydiyyat" and the workflow header
 * "Elvin Əliyev · Şəxsi kabinet"). Values are copied verbatim from the profile form.
 */
export const currentUser: AccountProfile = {
  id: 'u-elvin',
  fullName: 'Elvin Əliyev',
  email: 'info@absheronting.az',
  phone: '+994 50 555 12 34',
  accountType: 'business',
  sellerId: 'abseron-tingcilik',
  role: 'user',
  locale: 'az',
  companyName: 'Abşeron Tingçilik',
  businessKinds: ['nursery'],
  cityId: 'abseron',
  address: 'Məhəmmədi qəsəbəsi, tingçilik təsərrüfatı',
  about:
    'Abşeron iqliminə uyğun dekorativ ağaclar və meyvə fidanları yetişdiririk. Bakı və Abşerona çatdırılma və əkin məsləhəti təqdim edirik.',
  verified: true,
  phoneVerified: true,
  notifications: { moderation: true, expiry: true, news: false },
}
