import type { AccountProfile } from '@/data/user'
import { orderedKinds } from '@/features/seller/businessKinds'
import type { OwnSeller, UserProfile } from '@/types'

/**
 * The account as the cabinet shows it (DATA_SOURCE=api): `GET /me` and, for a business, its profile («mağaza»,
 * `GET /me/seller`) in the shape the profile form and the cabinet already use (`AccountProfile`).
 */
export function accountOf(user: UserProfile, seller?: OwnSeller): AccountProfile {
  return {
    ...user,
    // Every account's number was confirmed by an SMS code (registration, «nömrəni dəyiş»).
    phoneVerified: Boolean(user.phone),
    ...(seller
      ? {
          companyName: seller.name,
          businessKinds: orderedKinds(seller.businessKinds),
          cityId: seller.cityId,
          address: seller.address,
          about: seller.about,
          verified: seller.verified,
          sellerSlug: seller.slug,
          sellerImage: seller.image,
          sellerVersion: seller.version,
        }
      : {}),
  }
}
