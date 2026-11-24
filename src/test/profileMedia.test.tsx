import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { baseWindow, clampCrop, cropWindow, initialCrop, isLargeEnough, moveCrop, outputSize, zoomBounds, zoomCrop } from '@/features/account/profile/cropGeometry'
import { PhotoCropDialog } from '@/features/account/profile/PhotoCropDialog'
import { ProfileCompleteness, profileCompleteness } from '@/features/account/profile/ProfileCompleteness'
import { ProfileHero } from '@/features/account/profile/ProfileHero'
import { PHOTO_SPECS, fileProblem, sizeProblem, uploadErrorText, uploadProfilePhoto } from '@/features/account/profile/profilePhotos'

/*
 * The business profile's logo and cover on /kabinet/profil: the crop's geometry, the checks before an upload, the
 * upload's steps, «Profilin tamlığı», the crop dialog from the keyboard and the photo menus.
 */

const actions = vi.hoisted(() => ({ startProfilePhotoUpload: vi.fn(), saveProfilePhoto: vi.fn() }))
vi.mock('@/features/account/actions', () => actions)

const logo = PHOTO_SPECS.logo
const cover = PHOTO_SPECS.cover

describe('the crop geometry', () => {
  it('starts with the largest window of the shape, in the middle', () => {
    expect(baseWindow(1600, 1200, logo)).toEqual({ width: 1200, height: 1200 })
    expect(baseWindow(3000, 1000, cover)).toEqual({ width: 3000, height: 750 })
    expect(baseWindow(5000, 1000, cover)).toEqual({ width: 4000, height: 1000 })
    expect(cropWindow(initialCrop(1600, 1200), 1600, 1200, logo)).toEqual({ x: 200, y: 0, width: 1200, height: 1200 })
  })

  it('zooms only as far as the API still takes the result', () => {
    // A 1200 px window may shrink to 400 px (the logo's minimum): 3×.
    expect(zoomBounds(1600, 1200, logo)).toEqual({ min: 1, max: 3 })
    // A cover of 2400 px may shrink to 1200 px: 2×.
    expect(zoomBounds(2400, 600, cover)).toEqual({ min: 1, max: 2 })
    // A huge picture stops at maxZoom.
    expect(zoomBounds(8000, 8000, logo).max).toBe(4)
    expect(zoomCrop(initialCrop(1600, 1200), 10, 1600, 1200, logo).zoom).toBe(3)
    expect(zoomCrop(initialCrop(1600, 1200), 0.2, 1600, 1200, logo).zoom).toBe(1)
  })

  it('never lets the window leave the picture', () => {
    const state = zoomCrop(initialCrop(1600, 1200), 2, 1600, 1200, logo)
    const right = moveCrop(state, 10_000, 10_000, 1600, 1200, logo)
    expect(cropWindow(right, 1600, 1200, logo)).toEqual({ x: 1000, y: 600, width: 600, height: 600 })
    const left = moveCrop(state, -10_000, -10_000, 1600, 1200, logo)
    expect(cropWindow(left, 1600, 1200, logo)).toMatchObject({ x: 0, y: 0 })
    // Zooming out again pulls a window at the edge back inside.
    expect(cropWindow(zoomCrop(right, 1, 1600, 1200, logo), 1600, 1200, logo)).toEqual({ x: 400, y: 0, width: 1200, height: 1200 })
    expect(clampCrop({ zoom: Number.NaN, cx: -5, cy: 99_999 }, 1600, 1200, logo)).toEqual({ zoom: 1, cx: 600, cy: 600 })
  })

  it('sends at most 800 px for a logo and 2400 × 600 px for a cover, never less than the minimum', () => {
    expect(outputSize({ x: 0, y: 0, width: 1200, height: 1200 }, logo)).toEqual({ width: 800, height: 800 })
    expect(outputSize({ x: 0, y: 0, width: 512.7, height: 512.7 }, logo)).toEqual({ width: 512, height: 512 })
    expect(outputSize({ x: 0, y: 0, width: 3000, height: 750 }, cover)).toEqual({ width: 2400, height: 600 })
    expect(outputSize(cropWindow({ zoom: 2, cx: 1200, cy: 300 }, 2400, 600, cover), cover)).toEqual({ width: 1200, height: 300 })
  })

  it('knows a picture too small for the slot', () => {
    expect(isLargeEnough(500, 500, logo)).toBe(true)
    expect(isLargeEnough(390, 2000, logo)).toBe(false)
    expect(isLargeEnough(1300, 300, cover)).toBe(true)
    // 1000 px wide: the 4:1 window is 1000 × 250, under 1200 × 300.
    expect(isLargeEnough(1000, 600, cover)).toBe(false)
  })
})

describe('the checks before an upload', () => {
  it('takes JPG, PNG and WebP up to 10 MB', () => {
    expect(fileProblem({ type: 'image/jpeg', size: 1000 })).toBeUndefined()
    expect(fileProblem({ type: 'image/heic', size: 1000 })).toBe('Yalnız JPG, PNG və ya WebP şəkil seçin.')
    expect(fileProblem({ type: 'image/png', size: 11 * 1024 * 1024 })).toBe('Şəkil 10 MB-dan böyük olmamalıdır.')
  })

  it('says how large a logo and a cover must be', () => {
    expect(sizeProblem('logo', 800, 600)).toBeUndefined()
    expect(sizeProblem('logo', 300, 300)).toBe('Şəkil çox kiçikdir (300 × 300). Loqo üçün ən azı 400 × 400 piksel olsun.')
    expect(sizeProblem('cover', 1000, 600)).toBe('Şəkil çox kiçikdir (1000 × 600). Üz şəkli üçün ən azı 1200 × 300 piksel olsun.')
    expect(uploadErrorText('cover', 'photo.wrong-shape')).toBe('Üz şəkli 4:1 ölçüsündə olmalıdır. Şəkli yenidən kəsin.')
    expect(uploadErrorText('logo', 'photo.too-small')).toBe('Şəkil çox kiçikdir. Loqo üçün ən azı 400 × 400 piksel olsun.')
  })
})

describe('uploadProfilePhoto', () => {
  const blob = new Blob(['x'], { type: 'image/webp' })
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const refused = (code: string, status = 422) => new Response(JSON.stringify({ code }), { status, headers: { 'Content-Type': 'application/problem+json' } })
  const address = { ok: true as const, upload: { photoId: 'p1', uploadUrl: 'https://api.test/api/v1/photo-uploads/t', expiresAt: '' } }
  const account = { id: 'u1', fullName: 'A', email: '', phone: '', accountType: 'business' as const, role: 'user' as const, locale: 'az' as const, sellerLogo: 'https://cdn/logo.webp' }

  it('asks for an address, sends the cropped picture there and puts it on the profile', async () => {
    const start = vi.fn().mockResolvedValue(address)
    const put = vi.fn().mockResolvedValue(ok({ photoId: 'p1', status: 'ready', width: 800, height: 800, url: 'u' }))
    const save = vi.fn().mockResolvedValue({ ok: true, account })

    const result = await uploadProfilePhoto('logo', blob, { start, put, save })

    expect(result).toEqual({ ok: true, account })
    expect(start).toHaveBeenCalledWith({ slot: 'logo', contentType: 'image/webp', bytes: 1 })
    expect(put).toHaveBeenCalledWith(address.upload.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/webp' } })
    expect(save).toHaveBeenCalledWith('logo', 'p1')
  })

  it('asks once more when the address has run out, and says why a file is refused', async () => {
    const start = vi.fn().mockResolvedValue(address)
    const save = vi.fn().mockResolvedValue({ ok: true, account })
    const expiredThenOk = vi.fn().mockResolvedValueOnce(refused('photo.upload-expired', 410)).mockResolvedValueOnce(ok({ photoId: 'p1' }))
    expect((await uploadProfilePhoto('cover', blob, { start, put: expiredThenOk, save })).ok).toBe(true)
    expect(start).toHaveBeenCalledTimes(2)

    const shape = await uploadProfilePhoto('cover', blob, { start, put: vi.fn().mockResolvedValue(refused('photo.wrong-shape')), save })
    expect(shape).toEqual({ ok: false, error: 'Üz şəkli 4:1 ölçüsündə olmalıdır. Şəkli yenidən kəsin.' })

    const signedOut = { ok: false as const, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.', signedOut: true }
    expect(await uploadProfilePhoto('logo', blob, { start: vi.fn().mockResolvedValue(signedOut), put: vi.fn(), save })).toEqual(signedOut)
  })
})

describe('«Profilin tamlığı»', () => {
  it('counts the five things buyers look for', () => {
    expect(profileCompleteness({}).percent).toBe(0)
    expect(profileCompleteness({ logo: 'l', cover: 'c', about: '  ', address: 'Bakı', email: 'a@b.az' }).percent).toBe(80)
    expect(profileCompleteness({ logo: 'l', cover: 'c', about: 'x', address: 'y', email: 'z' }).percent).toBe(100)
  })

  it('shows the bar and offers what is missing', async () => {
    const onAdd = vi.fn()
    const { percent, items } = profileCompleteness({ about: 'Haqqında', email: 'a@b.az' })
    render(<ProfileCompleteness percent={percent} items={items} onAdd={onAdd} />)

    expect(screen.getByRole('progressbar', { name: 'Profilin tamlığı' })).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText('40%')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Üz şəkli: əlavə et' }))
    expect(onAdd).toHaveBeenCalledWith('cover')
    expect(screen.queryByRole('button', { name: 'E-poçt: əlavə et' })).not.toBeInTheDocument()
  })
})

describe('the crop dialog', () => {
  const image = { url: 'blob:foto', width: 1600, height: 1200 }

  it('moves and zooms from the keyboard, within bounds, and hands over the crop', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const rendered = new Blob(['crop'], { type: 'image/webp' })
    const renderCrop = vi.fn().mockResolvedValue(rendered)
    render(<PhotoCropDialog slot="logo" image={image} onCancel={vi.fn()} onConfirm={onConfirm} render={renderCrop} />)

    const dialog = screen.getByRole('dialog', { name: 'Loqonu yerləşdirin' })
    const slider = within(dialog).getByRole('slider', { name: 'Böyütmə' })
    expect(slider).toHaveAttribute('max', '3')
    expect(slider).toHaveAttribute('aria-valuetext', '100%')
    expect(within(dialog).getByRole('button', { name: 'Kiçilt' })).toBeDisabled()

    const stage = within(dialog).getByRole('group', { name: 'Loqo: şəklin yeri' })
    const picture = stage.querySelector('img')!
    const start = picture.style.transform
    stage.focus()
    await user.keyboard('{ArrowRight}')
    expect(picture.style.transform).not.toBe(start)
    await user.keyboard('++')
    expect(slider).toHaveAttribute('aria-valuetext', '120%')
    for (let i = 0; i < 30; i++) await user.keyboard('+')
    expect(slider).toHaveAttribute('aria-valuetext', '300%')
    expect(within(dialog).getByRole('button', { name: 'Böyüt' })).toBeDisabled()
    await user.keyboard('0')
    expect(slider).toHaveAttribute('aria-valuetext', '100%')

    await user.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(rendered))
    expect(renderCrop).toHaveBeenCalledWith(picture, { zoom: 1, cx: 800, cy: 600 }, 'logo')
  })

  it('cannot zoom a picture that is only just large enough', () => {
    render(<PhotoCropDialog slot="cover" image={{ url: 'blob:x', width: 1200, height: 300 }} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('slider', { name: 'Böyütmə' })).toBeDisabled()
    expect(screen.getByText('Şəkil kiçik olduğu üçün onu böyütmək olmur.')).toBeInTheDocument()
  })
})

describe('the profile hero', () => {
  afterEach(() => vi.clearAllMocks())

  const props = { name: 'Green Garden', kinds: 'Bağ mərkəzi', city: 'Bakı', publicHref: '/saticilar/green-garden', api: false }

  it('offers to add a logo and a cover when there are none', () => {
    render(<ProfileHero {...props} onSaved={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Green Garden' })).toBeInTheDocument()
    expect(screen.getByText('GG')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Loqo əlavə et' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Üz şəkli əlavə et/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'İctimai profilə bax' })).toHaveAttribute('href', '/saticilar/green-garden')
  })

  it('changes or removes a cover from its menu, asking before it removes', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<ProfileHero {...props} cover="/images/cover.webp" logo="/images/logo.webp" onSaved={onSaved} />)

    expect(screen.getByRole('img', { name: 'Green Garden loqosu' })).toHaveAttribute('src', '/images/logo.webp')
    await user.click(screen.getByRole('button', { name: 'Üz şəklini redaktə et' }))
    expect(screen.getByRole('button', { name: 'Üz şəklini dəyiş' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sil' }))

    const confirm = screen.getByRole('dialog', { name: 'Üz şəklini silək?' })
    await user.click(within(confirm).getByRole('button', { name: 'Sil' }))
    expect(onSaved).toHaveBeenCalledWith({ sellerCover: '' })
  })

  it('removes the logo through the API in api mode', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const account = { id: 'u1', sellerLogo: undefined }
    actions.saveProfilePhoto.mockResolvedValue({ ok: true, account })
    render(<ProfileHero {...props} api logo="https://cdn/logo.webp" onSaved={onSaved} />)

    await user.click(screen.getByRole('button', { name: 'Loqonu redaktə et' }))
    await user.click(screen.getByRole('button', { name: 'Sil' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Loqonu silək?' })).getByRole('button', { name: 'Sil' }))

    expect(actions.saveProfilePhoto).toHaveBeenCalledWith('logo', null)
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(account))
  })

  it('refuses a file it cannot use before cropping', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<ProfileHero {...props} onSaved={vi.fn()} />)

    await user.upload(screen.getByTestId('logo-input'), new File(['x'], 'foto.heic', { type: 'image/heic' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Yalnız JPG, PNG və ya WebP şəkil seçin.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
