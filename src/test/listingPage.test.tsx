import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { listingById } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import { careItems, factRows, frostLabel, listingPrice, monthsLabel, stockLabel, wholesaleLabel } from '@/features/listing/facts'
import { responseLabel, initials } from '@/features/listing/SellerSummary'
import { AppStoreProvider } from '@/state/store'
import { ListingDetail } from '@/views/ListingDetailPage'

const recordPhoneReveal = vi.fn(async (id: string) => void id)
const sendReport = vi.fn(async (input: unknown) => (void input, { ok: true as const, id: 'rep-1' }))
vi.mock('@/features/listing/actions', () => ({
  recordPhoneReveal: (id: string) => recordPhoneReveal(id),
  sendReport: (input: unknown) => sendReport(input),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/elanlar/x',
  useSearchParams: () => new URLSearchParams(),
}))

describe('listing facts', () => {
  const zeytun = listingById('zeytun-agaci')!

  it('reads price, unit, bargaining, wholesale and stock', () => {
    expect(listingPrice(zeytun)).toEqual({ amount: '145 ₼', unit: '/ ədəd', note: 'Qiymətdə razılaşmaq olar' })
    expect(wholesaleLabel(zeytun)).toBe('130 ₼ / ədəd, 10 ədəddən')
    expect(stockLabel(zeytun)).toBe('40 ədəd')
    expect(wholesaleLabel({ wholesale: { price: 6, minQuantity: 30 }, priceUnit: 'bag' })).toBe('6 ₼ / kisə, 30 kisədən')
    expect(wholesaleLabel({ wholesale: { price: 2, minQuantity: 50 }, priceUnit: 'kg' })).toBe('2 ₼ / kq, 50 kq-dan')
  })

  it('shows «Razılaşma ilə» without a price', () => {
    expect(listingPrice({ price: 0 })).toEqual({ amount: 'Razılaşma ilə' })
    expect(listingPrice({ price: 50, priceType: 'agreement' }).amount).toBe('Razılaşma ilə')
  })

  it('joins planting months into ranges and words frost hardiness', () => {
    expect(monthsLabel([3, 4, 5, 9, 10])).toBe('Mart–may, sentyabr–oktyabr')
    expect(monthsLabel([4])).toBe('Aprel')
    expect(frostLabel(-10)).toBe('−10 °C-yə qədər')
    expect(frostLabel(12)).toMatch(/Şaxtaya dözmür/)
  })

  it('builds the attributes table and the care block from the plant facts', () => {
    const rows = factRows(zeytun)
    expect(rows[0]).toEqual({ label: 'Kateqoriya', value: 'Ağaclar / Dekorativ ağaclar' })
    expect(rows.find((r) => r.label === 'Növ')).toMatchObject({ value: 'Olea europaea', latin: true })
    expect(rows.find((r) => r.label === 'Kök sistemi')?.value).toBe('Dibçəkdə')
    expect(careItems(zeytun.plant).map((c) => c.label)).toEqual(['İşıq', 'Suvarma', 'Şaxtaya davamlılıq', 'Əkin vaxtı'])
    expect(careItems(undefined)).toEqual([])
  })

  it('words the seller summary', () => {
    expect(initials('Abşeron Tingçilik')).toBe('AT')
    expect(initials('istanbul')).toBe('İ')
    expect(responseLabel(30)).toBe('Adətən 30 dəqiqə ərzində cavab verir')
    expect(responseLabel(180)).toBe('Adətən 3 saat ərzində cavab verir')
  })
})

describe('listing page', () => {
  beforeEach(() => {
    recordPhoneReveal.mockClear()
    sendReport.mockClear()
  })

  const renderPage = (id: string) => {
    const listing = listingById(id)!
    return render(
      <AppStoreProvider>
        <ListingDetail listing={listing} seller={sellerById(listing.sellerId)} others={[]} similar={[]} />
      </AppStoreProvider>,
    )
  }

  it('reveals the number as a call link and counts the reveal', async () => {
    const user = userEvent.setup()
    renderPage('zeytun-agaci')
    const panel = screen.getByRole('complementary', { name: 'Qiymət və əlaqə' })
    await user.click(within(panel).getByRole('button', { name: 'Nömrəni göstər' }))
    expect(within(panel).getByRole('link', { name: 'Zəng et: 050 555 12 34' })).toHaveAttribute('href', 'tel:+994505551234')
    expect(recordPhoneReveal).toHaveBeenCalledWith('zeytun-agaci')
    const whatsapp = within(panel).getByRole('link', { name: 'WhatsApp-a yaz' })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/994505551234\?text=/)
  })

  it('offers WhatsApp only when the seller hid the number', () => {
    renderPage('limon-agaci')
    const panel = screen.getByRole('complementary', { name: 'Qiymət və əlaqə' })
    expect(within(panel).queryByRole('button', { name: 'Nömrəni göstər' })).not.toBeInTheDocument()
    expect(within(panel).getByText(/zəng qəbul etmir/)).toBeInTheDocument()
  })

  it('moves the gallery with the thumbnails and opens the viewer', async () => {
    const user = userEvent.setup()
    renderPage('zeytun-agaci')
    const gallery = screen.getByRole('region', { name: /şəkillər/ })
    await user.click(within(gallery).getByRole('button', { name: 'Şəkil 3' }))
    expect(within(gallery).getByRole('button', { name: 'Şəkil 3' })).toHaveAttribute('aria-current', 'true')
    await user.click(within(gallery).getByRole('button', { name: 'Şəkli böyüt: 3 / 4' }))
    const viewer = screen.getByRole('dialog', { name: /şəkillər/ })
    await user.keyboard('{Escape}')
    expect(viewer).not.toBeInTheDocument()
  })

  it('sends a report with a reason and confirms it', async () => {
    const user = userEvent.setup()
    renderPage('zeytun-agaci')
    await user.click(screen.getByRole('button', { name: 'Elanı şikayət et' }))
    const dialog = screen.getByRole('dialog', { name: 'Elanı şikayət et' })
    await user.click(within(dialog).getByRole('button', { name: 'Şikayəti göndər' }))
    expect(within(dialog).getByText('Səbəbi seçin.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Digər səbəb' }))
    await user.click(within(dialog).getByRole('button', { name: 'Şikayəti göndər' }))
    expect(within(dialog).getByText(/ən azı 10 simvol/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Qiymət düzgün deyil' }))
    await user.click(within(dialog).getByRole('button', { name: 'Şikayəti göndər' }))
    expect(sendReport).toHaveBeenCalledWith({ target: 'listing', targetId: 'zeytun-agaci', reason: 'Qiymət düzgün deyil', comment: '' })
    expect(await within(dialog).findByText('Şikayətiniz göndərildi')).toBeInTheDocument()
  })
})
