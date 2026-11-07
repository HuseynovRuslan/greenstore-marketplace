import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { attributeLine, attributesFor, parseNumberValue, plantFacts, unitsFor, visibleAttributes } from '@/features/posting/attributes'
import { createDraft, restoreDraft, toListing, toListingInput, withCategory, type PostingDraft } from '@/features/posting/draft'
import { fileError, fitCount, makeCover, movePhoto, sizeError } from '@/features/posting/photos'
import { firstInvalidStep, validateStep } from '@/features/posting/validation'
import { PostingWizard } from '@/features/posting/PostingWizard'
import { AppStoreProvider } from '@/state/store'

const push = vi.fn()
const replace = vi.fn()
// Long user-event flows: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20_000 })

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/elan-yerlesdir',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/features/posting/actions', () => ({ submitPosting: vi.fn() }))

/** A draft that passes every step. */
function completeDraft(): PostingDraft {
  const d = withCategory(createDraft({ name: 'Elvin', phone: '+994505551234' }), 'product', 'agaclar')
  return {
    ...d,
    subcategory: 'İynəyarpaqlılar',
    title: 'Tuya Smaragd — 140 sm',
    description: 'Sağlam, sıx formalı tinglər, dibçəkdə yetişdirilib.',
    attrs: { heightMin: '140', rootSystem: 'container', potLitres: '15', availability: 'satisda', frost: '−35', plantingMonths: '3,4,10', age: '3' },
    photos: [{ id: 'ph_1', name: 'a.jpg', width: 1200, height: 900 }],
    price: '55',
    wholesale: true,
    wholesalePrice: '48',
    wholesaleMin: '20',
    cityId: 'abseron',
    delivery: true,
    deliveryAreas: 'Bakı',
    rulesAccepted: true,
  }
}

describe('posting attributes', () => {
  it('asks plant facts for plant categories and a pack size for soil', () => {
    expect(attributesFor('agaclar').map((a) => a.id)).toContain('rootSystem')
    expect(attributesFor('torpaq-gubreler').map((a) => a.id)).toEqual(['pack', 'composition', 'availability'])
    expect(attributesFor('landsaft-xidmetleri')[0].kind).toBe('cities')
  })

  it('asks the pot size only for container plants', () => {
    expect(visibleAttributes('agaclar', {}).some((a) => a.id === 'potLitres')).toBe(false)
    expect(visibleAttributes('agaclar', { rootSystem: 'container' }).some((a) => a.id === 'potLitres')).toBe(true)
  })

  it('turns values into PlantFacts and the card line', () => {
    const d = completeDraft()
    expect(plantFacts('agaclar', d.attrs)).toEqual({
      heightCm: { min: 140 },
      ageYears: 3,
      rootSystem: 'container',
      potLitres: 15,
      frostHardinessC: -35,
      plantingMonths: [3, 4, 10],
    })
    expect(attributeLine('agaclar', d.attrs)).toEqual(['140 sm', '3 yaş', 'dibçəkdə'])
    expect(attributeLine('bag-avadanliqlari', { condition: 'new', brand: 'Gardena' })).toEqual(['Yeni', 'Gardena'])
    expect(parseNumberValue('7,5')).toBe(7.5)
    expect(parseNumberValue('abc')).toBeUndefined()
  })

  it('offers units that fit the category', () => {
    expect(unitsFor('torpaq-gubreler')[0]).toBe('bag')
    expect(unitsFor('landsaft-xidmetleri')).toContain('hour')
  })
})

describe('posting draft', () => {
  it('restores only a v2 draft and fills missing fields', () => {
    expect(restoreDraft({ version: 1, title: 'x' }).title).toBe('')
    const restored = restoreDraft({ version: 2, title: 'Tuya', reachedStep: 9 })
    expect(restored.title).toBe('Tuya')
    expect(restored.reachedStep).toBe(1)
    expect(restored.whatsapp).toBe(true)
  })

  it('resets the category-dependent fields when the category changes', () => {
    const changed = withCategory(completeDraft(), 'product', 'torpaq-gubreler')
    expect(changed.attrs).toEqual({})
    expect(changed.subcategory).toBe('')
    expect(changed.priceUnit).toBe('bag')
  })

  it('builds the ListingInput the API receives', () => {
    expect(toListingInput(completeDraft())).toMatchObject({
      kind: 'product',
      categoryId: 'agaclar',
      priceType: 'fixed',
      price: 55,
      priceUnit: 'piece',
      wholesale: { price: 48, minQuantity: 20 },
      contactPhone: '+994505551234',
      photoIds: ['ph_1'],
      deliveryAreas: 'Bakı',
    })
    expect(toListingInput({ ...completeDraft(), priceType: 'agreement' })).toMatchObject({ price: undefined, wholesale: undefined, priceUnit: undefined })
  })

  it('builds the preview and the cabinet copy', () => {
    const listing = toListing(completeDraft(), { images: ['blob:a'], now: new Date('2026-11-07T10:00:00Z'), number: 10540 })
    expect(listing).toMatchObject({ id: 'elan-10540', slug: 'tuya-smaragd-140-sm-10540', status: 'pending', cover: 'blob:a', attributes: ['140 sm', '3 yaş', 'dibçəkdə'] })
  })
})

describe('posting validation', () => {
  it('passes a complete draft', () => {
    expect(firstInvalidStep(completeDraft())).toBeUndefined()
  })

  it('asks for kind, category and sub-category in turn', () => {
    expect(validateStep(1, createDraft())).toEqual({ kind: 'Məhsul və ya xidmət seçin.' })
    expect(validateStep(1, { ...createDraft(), kind: 'product' })).toEqual({ categoryId: 'Kateqoriyanı seçin.' })
    expect(validateStep(1, withCategory(createDraft(), 'product', 'agaclar'))).toEqual({ subcategory: 'Alt kateqoriyanı seçin.' })
  })

  it('checks the details: title, required attributes, ranges and a phone number in the text', () => {
    const d = completeDraft()
    expect(validateStep(2, { ...d, title: 'abc' }).title).toMatch(/ən azı 5/)
    expect(validateStep(2, { ...d, attrs: { ...d.attrs, heightMin: '' } })['attr.heightMin']).toBe('Bitkinin hündürlüyü yazın.')
    expect(validateStep(2, { ...d, attrs: { ...d.attrs, heightMax: '100' } })['attr.heightMax']).toMatch(/kiçik ola bilməz/)
    expect(validateStep(2, { ...d, attrs: { ...d.attrs, rootSystem: '' } })['attr.rootSystem']).toMatch(/birini seçin/)
    expect(validateStep(2, { ...d, description: 'Zəng edin: 050 555 12 34, hər gün açığıq.' }).description).toMatch(/Telefon nömrəsini/)
  })

  it('needs a photo', () => {
    expect(validateStep(3, { ...completeDraft(), photos: [] }).photos).toMatch(/Ən azı bir şəkil/)
  })

  it('checks price, unit, wholesale below retail, city and delivery areas', () => {
    const d = completeDraft()
    expect(validateStep(4, { ...d, price: '' }).price).toBe('Qiyməti yazın.')
    expect(validateStep(4, { ...d, price: '-5' }).price).toMatch(/sıfırdan az/)
    expect(validateStep(4, { ...d, wholesalePrice: '60' }).wholesalePrice).toMatch(/aşağı olmalıdır/)
    expect(validateStep(4, { ...d, wholesaleMin: '1' }).wholesaleMin).toMatch(/ən azı 2/)
    expect(validateStep(4, { ...d, cityId: '' }).cityId).toBeTruthy()
    expect(validateStep(4, { ...d, deliveryAreas: ' ' }).deliveryAreas).toBeTruthy()
    expect(validateStep(4, { ...d, priceType: 'agreement', price: '' })).toEqual({})
  })

  it('checks contact: name, phone, and WhatsApp when the number is hidden', () => {
    const d = completeDraft()
    expect(validateStep(5, { ...d, phone: '+994 50 555' }).phone).toMatch(/9 rəqəm/)
    expect(validateStep(5, { ...d, hidePhone: true, whatsapp: false }).whatsapp).toMatch(/WhatsApp-ı açın/)
    expect(validateStep(6, { ...d, rulesAccepted: false }).rulesAccepted).toBeTruthy()
  })
})

describe('posting photos', () => {
  it('says why a file is refused', () => {
    expect(fileError({ name: 'a.heic', type: 'image/heic', size: 1000 })).toMatch(/HEIC/)
    expect(fileError({ name: 'a.gif', type: 'image/gif', size: 1000 })).toMatch(/JPG, PNG və ya WebP/)
    expect(fileError({ name: 'a.jpg', type: 'image/jpeg', size: 11 * 1024 * 1024 })).toMatch(/10 MB/)
    expect(fileError({ name: 'a.jpg', type: 'image/jpeg', size: 1000 })).toBeUndefined()
    expect(sizeError('a.jpg', 500, 400)).toMatch(/çox kiçikdir \(500×400\)/)
  })

  it('keeps at most 12 and reorders', () => {
    expect(fitCount(10, 5)).toEqual({ take: 2, message: 'Ən çoxu 12 şəkil: 3 şəkil əlavə olunmadı.' })
    const photos = ['a', 'b', 'c'].map((id) => ({ id, name: id, width: 1, height: 1 }))
    expect(movePhoto(photos, 0, 2).map((p) => p.id)).toEqual(['b', 'c', 'a'])
    expect(makeCover(photos, 2).map((p) => p.id)).toEqual(['c', 'a', 'b'])
    expect(movePhoto(photos, 0, 5)).toBe(photos)
  })
})

describe('posting wizard', () => {
  beforeEach(() => {
    localStorage.clear()
    push.mockClear()
    replace.mockClear()
  })

  it('shows what to fix after «Davam et», then moves on with the step saved', async () => {
    const user = userEvent.setup()
    render(
      <AppStoreProvider>
        <PostingWizard step={1} />
      </AppStoreProvider>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Nə yerləşdirirsiniz?' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /Davam et/ }))
    const summary = screen.getByRole('alert', { name: /düzəldin/ })
    expect(within(summary).getByRole('link', { name: /Məhsul və ya xidmət seçin/ })).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: /Məhsul satıram/ }))
    await user.click(screen.getByRole('radio', { name: 'Ağaclar' }))
    await user.click(screen.getByRole('radio', { name: 'Dekorativ ağaclar' }))
    await user.click(screen.getByRole('button', { name: /Davam et/ }))
    expect(push).toHaveBeenCalledWith('/elan-yerlesdir/2')
    const saved = JSON.parse(localStorage.getItem('greenstore:posting:draft') ?? '{}')
    expect(saved).toMatchObject({ kind: 'product', categoryId: 'agaclar', subcategory: 'Dekorativ ağaclar', reachedStep: 2 })
  })

  it('sends a deep link past the furthest step back there', () => {
    render(
      <AppStoreProvider>
        <PostingWizard step={4} />
      </AppStoreProvider>,
    )
    expect(replace).toHaveBeenCalledWith('/elan-yerlesdir/1')
  })
})
