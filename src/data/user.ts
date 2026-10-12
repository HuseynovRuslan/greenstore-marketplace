import type { UserProfile } from '@/types'

/**
 * Account details shown/edited in "Profil məlumatları" that are not part of the shared `UserProfile` DTO.
 * The mock session (`useSession`) stores the whole object, so these fields survive `updateProfile` patches.
 */
export interface AccountProfile extends UserProfile {
  /** "Şirkətin adı" (empty for individual accounts) */
  companyName?: string
  /** "Biznes növü seçin" */
  businessType?: string
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
}

export interface NotificationSettings {
  /** "Elanın moderasiya nəticəsi" */
  moderation: boolean
  /** "Müddətin bitməsi haqqında xəbərdarlıq" */
  expiry: boolean
  /** "Yeniliklər və xüsusi təkliflər" */
  news: boolean
}

/** "Biznes növü seçin" options — the selected value and the hint "Bağ mərkəzi və ya landşaft şirkəti də seçə bilərsiniz." */
export const businessTypes = ['Tingçilik təsərrüfatı', 'Bağ mərkəzi', 'Landşaft şirkəti']

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
  companyName: 'Abşeron Tingçilik',
  businessType: 'Tingçilik təsərrüfatı',
  cityId: 'abseron',
  address: 'Məhəmmədi qəsəbəsi, tingçilik təsərrüfatı',
  about:
    'Abşeron iqliminə uyğun dekorativ ağaclar və meyvə fidanları yetişdiririk. Bakı və Abşerona çatdırılma və əkin məsləhəti təqdim edirik.',
  verified: true,
  phoneVerified: true,
  notifications: { moderation: true, expiry: true, news: false },
}
