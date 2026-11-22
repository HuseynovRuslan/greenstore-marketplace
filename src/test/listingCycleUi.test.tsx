import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import type { AccountProfile } from '@/data/user'
import { changeLine, moderationHref, readModerationParams, reviewChecks, reviewDetails, sellerLine } from '@/features/admin/moderationApi'
import { createDraft, withCategory, type PostingDraft } from '@/features/posting/draft'
import { remotePhotos } from '@/features/posting/fromListing'
import { photoStore } from '@/features/posting/photos'
import { uploadDraftPhotos, uploadErrorText } from '@/features/posting/upload'
import { PostingWizard } from '@/features/posting/PostingWizard'
import { encodeSessionHint, SESSION_HINT_COOKIE } from '@/state/bootstrap'
import { AppStoreProvider } from '@/state/store'
import type { ModerationItem, OwnListing } from '@/types'
import DashboardPage from '@/views/account/DashboardPage'

/*
 * DATA_SOURCE=api in the browser, phase 3: the wizard uploads the photos to the API and sends the listing, «Elanlarım»
 * shows the API's listings and its actions go to the API, and the moderation page's wording of the API's facts. The
 * Server Actions are fakes (listingCycleActions.test.ts tests them).
 */

vi.setConfig({ testTimeout: 20_000 })

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/kabinet',
  useSearchParams: () => new URLSearchParams(),
}))

const account = vi.hoisted(() => ({ loadSession: vi.fn(), setFavorite: vi.fn(), mergeFavorites: vi.fn(), signOut: vi.fn() }))
vi.mock('@/features/account/actions', () => account)

const posting = vi.hoisted(() => ({ submitPosting: vi.fn(), startPhotoUpload: vi.fn(), previewSeller: vi.fn() }))
vi.mock('@/features/posting/actions', () => posting)

const cabinet = vi.hoisted(() => ({ loadOwnListings: vi.fn(), changeOwnListing: vi.fn() }))
vi.mock('@/features/cabinet/actions', () => cabinet)

const PHOTO = '01937a52-6c4e-7a1b-9f00-2d5c1e4b8a10'
const ID = '01937a52-0000-7a1b-9f00-2d5c1e4b8a10'

const business: AccountProfile = {
  id: '0193-u',
  fullName: 'Nigar Rzayeva',
  email: '',
  phone: '+994 55 512 34 56',
  accountType: 'business',
  sellerId: '0193-s',
  role: 'user',
  locale: 'az',
  phoneVerified: true,
  companyName: 'Yaşıl Həyət',
}

const setHint = () => (document.cookie = `${SESSION_HINT_COOKIE}=${encodeURIComponent(encodeSessionHint({ initials: 'NR', issuedAt: 1 }))}; path=/`)
const inApi = (ui: ReactNode) =>
  render(
    <AppStoreProvider dataSource="api">
      <ToastProvider>{ui}</ToastProvider>
    </AppStoreProvider>,
  )

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' })

/** A draft that passes every step, with one photo kept in this browser. */
function completeDraft(): PostingDraft {
  const d = withCategory(createDraft({ name: 'Nigar', phone: '+994555123456' }), 'product', 'agaclar')
  return {
    ...d,
    subcategory: 'İynəyarpaqlı ağaclar',
    title: 'Tuya Smaragd — 140 sm',
    description: 'Sağlam, sıx formalı tinglər, dibçəkdə yetişdirilib.',
    attrs: { heightMin: '140', rootSystem: 'container', availability: 'satisda' },
    photos: [{ id: 'ph_1', name: 'tuya.jpg', width: 1200, height: 900 }],
    price: '55',
    cityId: 'abseron',
    rulesAccepted: true,
    reachedStep: 6,
  }
}

const own = (patch: Partial<OwnListing> = {}): OwnListing => ({
  id: ID,
  slug: 'tuya-smaragd-140-sm-20324',
  number: 20324,
  title: 'Tuya Smaragd — 140 sm',
  price: 55,
  attributes: ['140 sm'],
  cityId: 'abseron',
  publishedAt: '2026-11-22T09:00:00Z',
  vip: false,
  categoryId: 'agaclar',
  cover: 'http://localhost:5080/media/p/2026/11/x/1280.webp',
  images: ['http://localhost:5080/media/p/2026/11/x/1280.webp'],
  status: 'active',
  expiresAt: '2026-12-22T09:00:00Z',
  kind: 'product',
  contactPhoneVerified: true,
  version: '9',
  photoIds: [PHOTO],
  ...patch,
})

beforeEach(() => {
  localStorage.clear()
  push.mockClear()
  replace.mockClear()
  for (const fn of [...Object.values(account), ...Object.values(posting), ...Object.values(cabinet)]) fn.mockReset()
  account.loadSession.mockResolvedValue({ account: business, favorites: [] })
  account.mergeFavorites.mockResolvedValue({ ok: true, favorites: [] })
  posting.previewSeller.mockResolvedValue(undefined)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }))
})

afterEach(() => {
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`
  vi.unstubAllGlobals()
})

describe('uploading the draft’s photos (DATA_SOURCE=api)', () => {
  const putOk = (photoId: string) => new Response(JSON.stringify({ photoId, status: 'ready', width: 1200, height: 900, url: `http://localhost:5080/media/${photoId}.webp` }), { status: 200 })

  it('uploads only the photos without an API id, keeps the order, and reports each', async () => {
    await photoStore.put('a', jpeg())
    await photoStore.put('c', jpeg())
    let n = 0
    const ask = vi.fn(async () => ({ ok: true as const, upload: { photoId: `p-${++n}`, uploadUrl: `http://localhost:5080/api/v1/photo-uploads/t${n}`, expiresAt: '' } }))
    const fetch = vi.fn(async (url: string) => putOk(`p-${url.slice(-1)}`))
    vi.stubGlobal('fetch', fetch)
    const progress: string[] = []
    const kept: string[] = []
    const photos = [
      { id: 'a', name: 'a.jpg', width: 1, height: 1 },
      { id: 'b', name: 'b.jpg', width: 1, height: 1, remoteId: 'p-old', url: 'http://localhost:5080/media/old.webp' },
      { id: 'c', name: 'c.jpg', width: 1, height: 1 },
    ]
    const result = await uploadDraftPhotos(photos, { ask, onProgress: (d, t) => progress.push(`${d}/${t}`), onUploaded: (p) => kept.push(p.id) })
    expect(result.ok && result.photos.map((p) => p.remoteId)).toEqual(['p-1', 'p-old', 'p-2'])
    expect(ask).toHaveBeenCalledTimes(2)
    expect(ask).toHaveBeenCalledWith({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 4 })
    expect(fetch).toHaveBeenCalledWith('http://localhost:5080/api/v1/photo-uploads/t1', expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }))
    expect(progress[0]).toBe('0/2')
    expect(progress.at(-1)).toBe('2/2')
    expect(kept.sort()).toEqual(['a', 'c'])
  })

  it('asks for a new address once when one has run out, and stops at a refused file', async () => {
    await photoStore.put('a', jpeg())
    const ask = vi.fn(async () => ({ ok: true as const, upload: { photoId: 'p', uploadUrl: 'http://localhost:5080/api/v1/photo-uploads/t', expiresAt: '' } }))
    const answers = [new Response(JSON.stringify({ code: 'photo.upload-expired' }), { status: 410 }), putOk('p')]
    vi.stubGlobal('fetch', vi.fn(async () => answers.shift()!))
    expect(await uploadDraftPhotos([{ id: 'a', name: 'a.jpg', width: 1, height: 1 }], { ask })).toMatchObject({ ok: true })
    expect(ask).toHaveBeenCalledTimes(2)

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'photo.too-small' }), { status: 422 })))
    expect(await uploadDraftPhotos([{ id: 'a', name: 'a.jpg', width: 1, height: 1 }], { ask })).toEqual({ ok: false, error: uploadErrorText('photo.too-small', 'a.jpg') })
    expect(uploadErrorText('photo.too-small', 'a.jpg')).toMatch(/600 piksel/)
  })

  it('says when a photo is not in this browser, or the session has ended', async () => {
    const ask = vi.fn(async () => ({ ok: false as const, error: 'Sessiyanın vaxtı bitib.', signedOut: true }))
    expect(await uploadDraftPhotos([{ id: 'none', name: 'x.jpg', width: 1, height: 1 }], { ask })).toMatchObject({ ok: false, error: expect.stringMatching(/tapılmadı/) })
    await photoStore.put('a', jpeg())
    expect(await uploadDraftPhotos([{ id: 'a', name: 'a.jpg', width: 1, height: 1 }], { ask })).toMatchObject({ ok: false, signedOut: true })
  })

  it('an edit keeps the listing’s photos by their API ids and addresses', () => {
    const photos = remotePhotos({ photoIds: ['p1', 'p2'], images: ['http://m/1.webp', 'http://m/2.webp'] })
    expect(photos.map((p) => [p.remoteId, p.url])).toEqual([
      ['p1', 'http://m/1.webp'],
      ['p2', 'http://m/2.webp'],
    ])
  })
})

describe('the posting wizard with DATA_SOURCE=api', () => {
  it('uploads the photo, sends the listing with a key, and the confirmation shows the API’s number', async () => {
    setHint()
    localStorage.setItem('greenstore:posting:draft', JSON.stringify(completeDraft()))
    await photoStore.put('ph_1', jpeg())
    posting.startPhotoUpload.mockResolvedValue({ ok: true, upload: { photoId: PHOTO, uploadUrl: 'http://localhost:5080/api/v1/photo-uploads/tok', expiresAt: '' } })
    const fetch = vi.fn(async () => new Response(JSON.stringify({ photoId: PHOTO, status: 'ready', width: 1200, height: 900, url: 'http://localhost:5080/media/p/1280.webp' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    posting.submitPosting.mockResolvedValue({ ok: true, result: { id: ID, slug: 'tuya-smaragd-140-sm-20324', number: 20324, status: 'pending' } })

    inApi(<PostingWizard step={6} />)
    const send = await screen.findByRole('button', { name: /Elanı göndər/ })
    await waitFor(() => expect(send).toBeEnabled())
    await userEvent.click(send)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/elan-yerlesdir/gonderildi'))
    expect(fetch).toHaveBeenCalledWith('http://localhost:5080/api/v1/photo-uploads/tok', expect.objectContaining({ method: 'PUT' }))
    const [sent, key] = posting.submitPosting.mock.calls[0]
    expect(sent.photos[0]).toMatchObject({ id: 'ph_1', remoteId: PHOTO })
    expect(key).toMatch(/^elan-/)
    expect(sent.sendKey).toBe(key)
    const last = JSON.parse(localStorage.getItem('greenstore:posting:last-sent') ?? '{}')
    expect(last).toMatchObject({ id: ID, edited: false, listing: { id: ID, number: 20324, slug: 'tuya-smaragd-140-sm-20324', cover: 'http://localhost:5080/media/p/1280.webp' } })
    // «Elanlarım» reads the API: nothing is kept in this browser's list.
    expect(JSON.parse(localStorage.getItem('greenstore:my-listings') ?? '[]')).toEqual([])
  })

  it('previews a business account’s listing under its «mağaza», as the API has it', async () => {
    setHint()
    localStorage.setItem('greenstore:posting:draft', JSON.stringify(completeDraft()))
    posting.previewSeller.mockResolvedValue({ id: '0193-s', slug: 'yasil-heyet', name: 'Yaşıl Həyət', type: 'business', cityId: 'baki', activeListings: 3, verified: false, image: '' })

    inApi(<PostingWizard step={6} />)

    const seller = await screen.findByRole('region', { name: 'Satıcı' })
    expect(await within(seller).findByRole('link', { name: 'Yaşıl Həyət' })).toHaveAttribute('href', '/saticilar/yasil-heyet')
    expect(within(seller).queryByText(/Fərdi satıcı/)).not.toBeInTheDocument()
    expect(posting.previewSeller).toHaveBeenCalledTimes(1)
  })

  it('keeps the draft and says why when the API refuses, with a way to the step', async () => {
    setHint()
    localStorage.setItem('greenstore:posting:draft', JSON.stringify({ ...completeDraft(), photos: [{ id: 'ph_1', name: 'tuya.jpg', width: 1200, height: 900, remoteId: PHOTO }] }))
    posting.submitPosting.mockResolvedValue({ ok: false, error: 'Təsvirdə telefon nömrəsi olmasın.', step: 2 })

    inApi(<PostingWizard step={6} />)
    const send = await screen.findByRole('button', { name: /Elanı göndər/ })
    await waitFor(() => expect(send).toBeEnabled())
    await userEvent.click(send)

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Təsvirdə telefon nömrəsi olmasın.')
    expect(within(notice).getByRole('link', { name: /«Məlumat» addımına keç/ })).toHaveAttribute('href', '/elan-yerlesdir/2')
    // The uploaded photo is not uploaded again.
    expect(posting.startPhotoUpload).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalledWith('/elan-yerlesdir/gonderildi')
  })
})

describe('«Elanlarım» with DATA_SOURCE=api', () => {
  it('shows the API’s listings, the reason of a rejection in words, and deactivates on the API', async () => {
    setHint()
    const rejected = own({ id: 'r-1', slug: 'r-20325', number: 20325, title: 'Qızılgül fidanı', status: 'rejected', rejectionReasonCode: 'bad-photos', rejectionNote: 'Şəkildə başqa bitki görünür' })
    cabinet.loadOwnListings.mockResolvedValue({ ok: true, listings: [own(), rejected], stats: { [ID]: { views: 12, phoneReveals: 3, favourites: 1, viewsByDay: [{ date: '2026-11-22', views: 12 }] } } })
    cabinet.changeOwnListing.mockResolvedValue({ ok: true, listing: own({ status: 'inactive' }) })

    inApi(<DashboardPage />)
    expect(await screen.findByText(/Şəkillər tələblərə uyğun deyil\. Şəkildə başqa bitki görünür\./)).toBeInTheDocument()
    const row = screen.getByRole('link', { name: 'Tuya Smaragd — 140 sm' }).closest('li')!
    expect(within(row).getByText('Aktiv')).toBeInTheDocument()

    await userEvent.click(within(row).getByRole('button', { name: /Daha çox/ }))
    await userEvent.click(screen.getByRole('button', { name: /Deaktiv et/ }))
    await waitFor(() => expect(cabinet.changeOwnListing).toHaveBeenCalledWith(ID, 'deactivate'))
    await waitFor(() => expect(within(screen.getByRole('link', { name: 'Tuya Smaragd — 140 sm' }).closest('li')!).getByText('Deaktiv')).toBeInTheDocument())
    expect(await screen.findByText('Elan axtarışdan gizlədildi')).toBeInTheDocument()
    // Nothing is kept in this browser.
    expect(localStorage.getItem('greenstore:cabinet:changes')).toBeNull()
  })

  it('keeps the row and says why when the API refuses', async () => {
    setHint()
    cabinet.loadOwnListings.mockResolvedValue({ ok: true, listings: [own({ status: 'expired' })], stats: {} })
    cabinet.changeOwnListing.mockResolvedValue({ ok: false, error: 'Elanın vəziyyəti bu arada dəyişib. Səhifəni yeniləyin.' })

    inApi(<DashboardPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Yenilə \(pulsuz\)/ }))
    expect(await screen.findByText('Elanın vəziyyəti bu arada dəyişib. Səhifəni yeniləyin.')).toBeInTheDocument()
    expect(cabinet.changeOwnListing).toHaveBeenCalledWith(ID, 'renew')
    expect(screen.getByText('Müddəti bitib', { selector: 'span' })).toBeInTheDocument()
  })
})

describe('the moderation page’s words for the API’s facts', () => {
  const item = (patch: Partial<ModerationItem> = {}): ModerationItem => ({
    id: ID,
    listingId: ID,
    number: 20324,
    title: 'Tuya Smaragd — 140 sm',
    sellerName: 'Yaşıl Həyət',
    submittedAt: '2026-11-22T09:00:00Z',
    categoryId: 'agaclar',
    kind: 'recheck',
    status: 'pending',
    revision: 2,
    version: '9',
    contactPhoneVerified: false,
    photoCount: 3,
    seller: { userId: 'u', sellerId: 's', name: 'Yaşıl Həyət', accountType: 'business', verified: true, activeListings: 24, memberSince: 2021 },
    listing: own({ subcategory: 'İynəyarpaqlı ağaclar', area: 'Məhəmmədi', contactName: 'Nigar Rzayeva', contactPhone: '+994 55 512 34 56', status: 'pending' }),
    changes: [],
    ...patch,
  })

  it('keeps the filters in the address and starts again at page 1 when one changes', () => {
    const state = readModerationParams({ status: 'approved', kind: 'recheck', sort: 'oldest', q: ' 20324 ', sehife: '3', item: ID })
    expect(state).toMatchObject({ status: 'approved', kind: 'recheck', sort: 'oldest', q: '20324', page: 3, item: ID })
    expect(moderationHref(state)).toBe(`/idareetme/moderasiya?status=approved&kind=recheck&sort=oldest&q=20324&sehife=3&item=${ID}`)
    expect(moderationHref(state, { status: 'pending' })).toBe('/idareetme/moderasiya?kind=recheck&sort=oldest&q=20324')
    expect(readModerationParams({ status: 'bogus', sehife: '-1', item: '../x' })).toEqual({ status: 'pending', sort: 'newest', q: '', page: 1 })
    expect(readModerationParams({ done: ID, decision: 'approve' }).done).toEqual({ listingId: ID, decision: 'approve' })
  })

  it('words the listing, the seller and the checklist', () => {
    expect(reviewDetails(item())).toBe('Ağaclar / İynəyarpaqlı ağaclar · 140 sm · Abşeron, Məhəmmədi')
    expect(sellerLine(item())).toBe('Yaşıl Həyət · Nigar Rzayeva · +994 55 512 34 56 · Təsdiqlənmiş biznes · 24 aktiv elan · 2021-ci ildən GreenStore-da')
    expect(reviewChecks(item())).toEqual([
      { text: 'Qiymət göstərilib', ok: true },
      { text: 'Əlaqə nömrəsi təsdiqlənməyib', ok: false },
      { text: '3 şəkil əlavə edilib', ok: true },
    ])
  })

  it('words the changes since the approved version', () => {
    expect(changeLine({ field: 'price', before: '145', after: '120' })).toEqual({ label: 'Qiymət', before: '145 ₼', after: '120 ₼' })
    expect(changeLine({ field: 'cityId', before: 'baki', after: 'abseron' })).toEqual({ label: 'Şəhər', before: 'Bakı', after: 'Abşeron' })
    expect(changeLine({ field: 'plant.rootSystem', after: 'container' })).toEqual({ label: 'Kök sistemi', before: '—', after: 'Dibçəkdə' })
    expect(changeLine({ field: 'deliveryAvailable', before: 'false', after: 'true' })).toEqual({ label: 'Çatdırılma', before: 'xeyr', after: 'bəli' })
    expect(changeLine({ field: 'attributes.condition', before: 'new', after: 'used' }).label).toBe('condition')
  })
})
