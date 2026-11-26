'use server'

import { cookies } from 'next/headers'
import { updateTag } from 'next/cache'
import type { AccountProfile } from '@/data/user'
import { ApiError, isApiError } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import { clearSession, refreshSession } from '@/services/session'
import { SESSION_COOKIE, SESSION_HINT_COOKIE } from '@/state/bootstrap'
import type { BusinessKind, FavoriteItems, OwnSeller, PhotoUpload, SellerProfilePatch } from '@/types'
import { waitText } from '@/features/auth/messages'
import { isValidEmail, messages } from '@/features/auth/validation'
import { orderedKinds } from '@/features/seller/businessKinds'
import { isPersonName } from '@/lib/names'
import { accountOf } from './profile'

/*
 * The signed-in account's Server Actions (DATA_SOURCE=api; backend-contract.md 2.1–2.3). The browser cannot read the
 * session (an httpOnly cookie), so the store asks these for the account, its favourites, and every change. The session
 * decides whose account it is: nothing here takes a user id.
 */

type Fail = { ok: false; error: string }

/** The session's account and favourites; `account: null` for a guest or an ended session. */
export interface SessionState {
  account: AccountProfile | null
  favorites: string[]
  /** The API could not be asked: the browser keeps its hint and asks again on the next page. */
  unavailable?: boolean
}

/** Whether the request carries one of the session cookies (an ended session's are removed then). */
async function hasSessionCookies(): Promise<boolean> {
  const store = await cookies()
  return store.has(SESSION_COOKIE) || store.has(SESSION_HINT_COOKIE)
}

/** On every page of a signed-in browser: who is signed in (`GET /me`, `/me/seller`) and their favourites. */
export async function loadSession(): Promise<SessionState> {
  const repo = getRepository()
  try {
    const user = await repo.getMe()
    if (!user) {
      if (await hasSessionCookies()) await clearSession()
      return { account: null, favorites: [] }
    }
    const [seller, favorites] = await Promise.all([user.accountType === 'business' ? repo.getOwnSeller() : undefined, repo.listFavorites()])
    await refreshSession(user.fullName)
    return { account: accountOf(user, seller), favorites }
  } catch {
    return { account: null, favorites: [], unavailable: true }
  }
}

/** «Çıxış»: ends the session on the API and removes the cookies. */
export async function signOut(): Promise<void> {
  await getRepository().logout()
}

/** «Şirkət və əlaqə məlumatları» / «Əlaqə məlumatları» of /kabinet/profil. */
export interface ProfileInput {
  fullName: string
  email: string
  /** Business accounts: their «mağaza» */
  companyName?: string
  /** One or more; left out, the shop's kinds stay */
  businessKinds?: BusinessKind[]
  cityId?: string
  address?: string
  about?: string
  /**
   * The «mağaza»'s `version` as the form was loaded (`AccountProfile.sellerVersion`): when the profile has changed
   * since (another tab or device), the API refuses (409) instead of overwriting that change.
   */
  sellerVersion?: string
}

export type ProfileField = 'company' | 'kinds' | 'contact' | 'email' | 'address' | 'about'

const FIELD_OF: Record<string, ProfileField> = { fullName: 'contact', contactPerson: 'contact', email: 'email', name: 'company', businessKinds: 'kinds', address: 'address', about: 'about' }

const FIELD_TEXT: Record<ProfileField, (code: string) => string> = {
  contact: (code) => (code === 'too-long' ? 'Ad ən çox 60 simvol olsun.' : code === 'invalid' ? 'Adı yalnız hərflərlə yazın.' : messages.nameRequired),
  email: () => messages.emailFormat,
  company: (code) => (code === 'too-long' ? 'Şirkətin adı ən çox 80 simvol olsun.' : code === 'too-short' ? 'Şirkətin adı ən azı 2 simvol olsun.' : messages.companyRequired),
  kinds: () => 'Ən azı bir biznes növü seçin.',
  address: () => 'Ünvan ən çox 200 simvol olsun.',
  about: () => 'Mətn ən çox 2000 simvol olsun.',
}

/** The API's limits of the profile's fields (AccountService, SellerProfileRules). */
const LIMITS = { fullName: 60, email: 254, companyMin: 2, company: 80, address: 200, about: 2000 }

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

type ProfileFields = { fullName: string; email: string; companyName: string; businessKinds?: BusinessKind[]; address: string; about: string }

/**
 * The API's field rules, checked before anything is sent: the account and its «mağaza» are two requests, and a shop
 * refused after the account was saved would leave the profile half-changed.
 */
function profileFieldError(fields: ProfileFields, business: boolean): { field: ProfileField; code: string } | undefined {
  if (!fields.fullName) return { field: 'contact', code: 'required' }
  if (fields.fullName.length > LIMITS.fullName) return { field: 'contact', code: 'too-long' }
  if (!isPersonName(fields.fullName)) return { field: 'contact', code: 'invalid' }
  if (fields.email && (fields.email.length > LIMITS.email || !isValidEmail(fields.email))) return { field: 'email', code: 'invalid' }
  if (!business) return undefined
  if (!fields.companyName) return { field: 'company', code: 'required' }
  if (fields.companyName.length < LIMITS.companyMin) return { field: 'company', code: 'too-short' }
  if (fields.companyName.length > LIMITS.company) return { field: 'company', code: 'too-long' }
  if (fields.businessKinds?.length === 0) return { field: 'kinds', code: 'required' }
  if (fields.address.length > LIMITS.address) return { field: 'address', code: 'too-long' }
  if (fields.about.length > LIMITS.about) return { field: 'about', code: 'too-long' }
  return undefined
}

/** The text of a refused save, by the API's code. */
function saveFailure(error: unknown): Fail & { field?: ProfileField } {
  if (isApiError(error, 'account.email-taken')) return { ok: false, field: 'email', error: 'Bu e-poçt başqa hesabdadır. Başqa e-poçt yazın.' }
  if (isApiError(error, 'concurrency-conflict')) return { ok: false, error: 'Profil başqa cihazda dəyişdirilib. Səhifəni yeniləyin və yenidən yoxlayın.' }
  if (isApiError(error, 'validation')) {
    const [name, codes] = Object.entries(error.problem.errors ?? {}).find(([key]) => FIELD_OF[key]) ?? []
    const field = name ? FIELD_OF[name] : undefined
    return field ? { ok: false, field, error: FIELD_TEXT[field](codes?.[0] ?? '') } : { ok: false, error: 'Məlumatları yoxlayın və yenidən saxlayın.' }
  }
  if (isApiError(error) && error.status === 401) return { ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.' }
  return { ok: false, error: 'Dəyişiklikləri saxlamaq alınmadı. Bir az sonra yenidən cəhd edin.' }
}

export type SaveProfileResult =
  | { ok: true; account: AccountProfile }
  | (Fail & {
      field?: ProfileField
      /** The account's name and e-mail were saved, its «mağaza» was not (`error` says why). */
      saved?: Pick<AccountProfile, 'fullName' | 'email'>
    })

/**
 * Saves the profile form: the account (`PATCH /me`: name, e-mail) and, for a business, its «mağaza» (`PATCH
 * /me/seller`: name, kinds, city, address, about; the contact person is the account's name). Every field is checked
 * against the API's rules first, and the shop's version against the one the form was loaded with, so in practice only
 * the API failing in between can stop the shop after the account was saved: `saved` then says what was. The public
 * seller page and the directory show the change at once (their cached reads are refreshed).
 */
export async function saveProfile(input: ProfileInput): Promise<SaveProfileResult> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Sorğu düzgün deyil.' }
  const repo = getRepository()
  const fields: ProfileFields = {
    fullName: text(input.fullName, LIMITS.fullName + 1),
    email: text(input.email, LIMITS.email + 1),
    companyName: text(input.companyName, LIMITS.company + 1),
    businessKinds: Array.isArray(input.businessKinds) ? orderedKinds(input.businessKinds) : undefined,
    address: text(input.address, LIMITS.address + 1),
    about: text(input.about, LIMITS.about + 1),
  }
  const sellerVersion = typeof input.sellerVersion === 'string' && input.sellerVersion ? input.sellerVersion : undefined
  let user
  let current: OwnSeller | undefined
  try {
    // The account type decides which rules apply; a session that has ended answers 401 here, before anything is sent.
    const me = await repo.getMe()
    if (!me) return saveFailure(new ApiError(401, 'unauthorized', 'me'))
    const business = me.accountType === 'business'
    const invalid = profileFieldError(fields, business)
    if (invalid) return { ok: false, field: invalid.field, error: FIELD_TEXT[invalid.field](invalid.code) }
    // The «mağaza» changed since the form was loaded (another tab or device): said before the account is saved too.
    // (PATCH /me/seller checks the version again, for a change in between.)
    current = business ? await repo.getOwnSeller() : undefined
    if (current && sellerVersion && current.version !== sellerVersion) return saveFailure(new ApiError(409, 'concurrency-conflict', 'me/seller'))
    user = await repo.updateMe({ fullName: fields.fullName, email: fields.email })
    if (user.accountType !== 'business') return { ok: true, account: accountOf(user) }
  } catch (error) {
    return saveFailure(error)
  }

  try {
    const version = sellerVersion ?? current?.version
    const patch: SellerProfilePatch = {
      name: fields.companyName,
      contactPerson: fields.fullName,
      address: fields.address,
      about: fields.about,
      ...(fields.businessKinds?.length ? { businessKinds: fields.businessKinds } : {}),
      ...(typeof input.cityId === 'string' && input.cityId ? { cityId: input.cityId } : {}),
      ...(version ? { version } : {}),
    }
    const seller = await repo.updateOwnSeller(patch)
    updateTag('sellers')
    return { ok: true, account: accountOf(user, seller) }
  } catch (error) {
    return { ...saveFailure(error), saved: { fullName: user.fullName, email: user.email } }
  }
}

/** Which of the «mağaza»'s photos: the logo or the cover («üz şəkli»). */
export type ProfilePhotoSlot = 'logo' | 'cover'

export type ProfilePhotoUpload = { ok: true; upload: PhotoUpload } | (Fail & { signedOut?: boolean })

export type SaveProfilePhotoResult = { ok: true; account: AccountProfile } | (Fail & { signedOut?: boolean })

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_BYTES = 10 * 1024 * 1024
const SIGNED_OUT = 'Sessiyanın vaxtı bitib. Yenidən daxil olun.'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const slotOf = (value: unknown): ProfilePhotoSlot | undefined => (value === 'logo' || value === 'cover' ? value : undefined)

/**
 * DATA_SOURCE=api: an upload address for the «mağaza»'s logo or cover (`POST /photos`, purpose `seller-logo` or
 * `seller-cover`). The browser crops the picture and sends it there itself, then `saveProfilePhoto` puts it on the
 * profile.
 */
export async function startProfilePhotoUpload(input: { slot: ProfilePhotoSlot; contentType: string; bytes: number }): Promise<ProfilePhotoUpload> {
  const slot = slotOf(input?.slot)
  const contentType = typeof input?.contentType === 'string' ? input.contentType : ''
  const bytes = typeof input?.bytes === 'number' && Number.isFinite(input.bytes) ? Math.floor(input.bytes) : 0
  if (!slot) return { ok: false, error: 'Sorğu düzgün deyil.' }
  if (!PHOTO_TYPES.includes(contentType)) return { ok: false, error: 'Yalnız JPG, PNG və ya WebP şəkil göndərmək olar.' }
  if (bytes <= 0 || bytes > PHOTO_MAX_BYTES) return { ok: false, error: 'Şəkil 10 MB-dan böyük olmamalıdır.' }
  const purpose = slot === 'logo' ? 'seller-logo' : 'seller-cover'
  try {
    return { ok: true, upload: await getRepository().createPhotoUpload({ fileName: `${purpose}.webp`, contentType, bytes, purpose }) }
  } catch (error) {
    if (isApiError(error) && error.status === 401) return { ok: false, error: SIGNED_OUT, signedOut: true }
    if (isApiError(error, 'photo.too-many')) return { ok: false, error: 'Bu gün çox şəkil yükləmisiniz. Bir neçə saat sonra yenidən cəhd edin.' }
    return { ok: false, error: 'Şəkli yükləmək alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin.' }
  }
}

/**
 * DATA_SOURCE=api: puts an uploaded photo on the «mağaza» as its logo or cover (`PATCH /me/seller`), or removes it
 * (`null`). The public seller page and the directory show it at once (their cached reads are refreshed).
 */
export async function saveProfilePhoto(slot: ProfilePhotoSlot, photoId: string | null): Promise<SaveProfilePhotoResult> {
  const which = slotOf(slot)
  if (!which || (photoId !== null && (typeof photoId !== 'string' || !UUID_RE.test(photoId)))) return { ok: false, error: 'Sorğu düzgün deyil.' }
  const repo = getRepository()
  try {
    const user = await repo.getMe()
    if (!user) return { ok: false, error: SIGNED_OUT, signedOut: true }
    const seller = await repo.updateOwnSeller(which === 'logo' ? { logoPhotoId: photoId } : { coverPhotoId: photoId })
    updateTag('sellers')
    return { ok: true, account: accountOf(user, seller) }
  } catch (error) {
    if (isApiError(error) && error.status === 401) return { ok: false, error: SIGNED_OUT, signedOut: true }
    if (isApiError(error, 'validation')) return { ok: false, error: 'Şəkil hazır deyil və ya artıq silinib. Onu yenidən seçin.' }
    return { ok: false, error: photoId ? 'Şəkli saxlamaq alınmadı. Bir az sonra yenidən cəhd edin.' : 'Şəkli silmək alınmadı. Bir az sonra yenidən cəhd edin.' }
  }
}

/** «Təhlükəsizlik»: the current and a new password. The API signs the account's other devices out. */
export async function changePassword(current: string, next: string): Promise<{ ok: true } | (Fail & { field?: 'current' | 'next' })> {
  if (typeof current !== 'string' || !current) return { ok: false, field: 'current', error: messages.currentPassword }
  if (typeof next !== 'string' || next.length < 8 || next.length > 128) return { ok: false, field: 'next', error: messages.passwordRule }
  try {
    const { ok } = await getRepository().changePassword({ current, next })
    return ok ? { ok: true } : { ok: false, field: 'current', error: 'Cari şifrə düzgün deyil.' }
  } catch (error) {
    if (isApiError(error, 'auth.locked')) return { ok: false, field: 'current', error: `Çox səhv cəhd oldu. ${waitText(error.retryAfterSec)} sonra yenidən yoxlayın.` }
    if (isApiError(error, 'validation')) return { ok: false, field: 'next', error: messages.passwordRule }
    if (isApiError(error) && error.status === 401) return { ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.' }
    return { ok: false, error: 'Şifrəni dəyişmək alınmadı. Bir az sonra yenidən cəhd edin.' }
  }
}

/** The new number, once the SMS code sent to it (purpose `change-phone`) is verified. */
export async function confirmPhoneChange(otpChallengeId: string): Promise<{ ok: true; phone: string } | Fail> {
  if (typeof otpChallengeId !== 'string' || !otpChallengeId) return { ok: false, error: 'Kodun vaxtı bitib. Yenisini istəyin.' }
  try {
    const user = await getRepository().changePhone({ otpChallengeId })
    return { ok: true, phone: user.phone }
  } catch (error) {
    if (isApiError(error, 'account.phone-taken')) return { ok: false, error: 'Bu nömrə başqa hesabdadır.' }
    return { ok: false, error: 'Nömrəni dəyişmək alınmadı. Kodu yenidən istəyin.' }
  }
}

/* ---------- «Seçilmişlər» ---------- */

const FAVORITE_ID = /^[A-Za-z0-9-]{1,80}$/

/** ♡ on a card or a page. `signedOut`: the session has ended (the store then treats the visitor as a guest). */
export async function setFavorite(kind: 'listing' | 'service', id: string, on: boolean): Promise<{ ok: boolean; signedOut?: boolean }> {
  if ((kind !== 'listing' && kind !== 'service') || typeof id !== 'string' || !FAVORITE_ID.test(id)) return { ok: false }
  try {
    await getRepository().setFavorite(kind, id, Boolean(on))
    return { ok: true }
  } catch (error) {
    return { ok: false, ...(isApiError(error) && error.status === 401 ? { signedOut: true } : {}) }
  }
}

/** After signing in: the guest's favourites (this browser's) join the account's. */
export async function mergeFavorites(keys: string[]): Promise<{ ok: true; favorites: string[] } | { ok: false }> {
  const valid = Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string' && k.length <= 100).slice(0, 500) : []
  try {
    const repo = getRepository()
    return { ok: true, favorites: valid.length ? await repo.mergeFavorites(valid) : await repo.listFavorites() }
  } catch {
    return { ok: false }
  }
}

/** The «Seçilmişlər» page: the account's favourites as cards. `null`: they could not be loaded. */
export async function loadFavoriteItems(): Promise<FavoriteItems | null> {
  try {
    return await getRepository().listFavoriteItems()
  } catch {
    return null
  }
}
