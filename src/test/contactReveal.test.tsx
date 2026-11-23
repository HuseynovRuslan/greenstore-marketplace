import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { listingById } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import { RevealProvider } from '@/features/contact/RevealContext'
import type { RevealResult } from '@/features/contact/actions'
import { loadSellerListings } from '@/features/seller/sellerListingQuery'
import { SellerContactButtons } from '@/features/seller/SellerContact'
import { ServiceContact } from '@/features/services/ServiceContact'
import { loadProviderNames } from '@/features/services/providerNames'
import { mockRepository } from '@/services/mockRepository'
import { AppStoreProvider } from '@/state/store'
import { ListingDetail } from '@/views/ListingDetailPage'
import SellerPage from '@/views/SellerPage'
import ServiceDetailPage from '@/views/ServiceDetailPage'

vi.setConfig({ testTimeout: 20_000 })

const actions = vi.hoisted(() => ({
  listing: vi.fn<(id: string) => Promise<RevealResult>>(),
  seller: vi.fn<(id: string) => Promise<RevealResult>>(),
}))
vi.mock('@/features/contact/actions', () => ({
  revealListingContact: (id: string) => actions.listing(id),
  revealSellerContact: (id: string) => actions.seller(id),
}))
vi.mock('@/features/listing/actions', () => ({ sendReport: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const open = vi.fn()

beforeEach(() => {
  actions.listing.mockReset().mockImplementation(async (id) => ({ ok: true, contact: await mockRepository.revealPhone(id) }))
  actions.seller.mockReset().mockImplementation(async (id) => ({ ok: true, contact: await mockRepository.revealSellerPhone(id) }))
  open.mockReset()
  vi.stubGlobal('open', open)
})
afterEach(() => vi.unstubAllGlobals())

/** The digits of the demo numbers these pages would show (Abşeron Tingçilik, «Limon ağacı», the services' demo number). */
const numbers = ['505551234', '517023314']
const noNumberIn = (html: string) => {
  const digits = html.replace(/<[^>]+>/g, ' ').replace(/[^\d]+/g, '')
  for (const n of numbers) expect(digits).not.toContain(n)
  expect(html).not.toMatch(/tel:|wa\.me/)
}

async function publicListing(id: string) {
  const listing = (await mockRepository.getPublicListing(listingById(id)!.slug))!
  const seller = listing.sellerId ? await mockRepository.getSellerById(listing.sellerId) : undefined
  return { listing, seller }
}

describe('listing page contact', () => {
  it('has no number in the page until «Nömrəni göstər» asks for it', async () => {
    const user = userEvent.setup()
    const { listing, seller } = await publicListing('zeytun-agaci')
    expect(JSON.stringify({ listing, seller })).not.toMatch(/555 12 34|505551234/)
    const { container } = render(
      <AppStoreProvider>
        <ListingDetail listing={listing} seller={seller} others={[]} similar={[]} />
      </AppStoreProvider>,
    )
    noNumberIn(container.innerHTML)
    expect(actions.listing).not.toHaveBeenCalled()

    const panel = screen.getByRole('complementary', { name: 'Qiymət və əlaqə' })
    await user.click(within(panel).getByRole('button', { name: 'Nömrəni göstər' }))
    expect(await within(panel).findByRole('link', { name: 'Zəng et: 050 555 12 34' })).toHaveFocus()
    // The mobile bar shares the answer: one request for the page.
    const bar = screen.getByRole('region', { name: 'Satıcı ilə əlaqə' })
    expect(within(bar).getByRole('link', { name: 'Zəng et: 050 555 12 34' })).toBeInTheDocument()
    expect(actions.listing).toHaveBeenCalledTimes(1)
  })

  it('opens WhatsApp from the first click, with the listing named in the message', async () => {
    const user = userEvent.setup()
    const { listing, seller } = await publicListing('limon-agaci')
    render(
      <AppStoreProvider>
        <ListingDetail listing={listing} seller={seller} others={[]} similar={[]} />
      </AppStoreProvider>,
    )
    const panel = screen.getByRole('complementary', { name: 'Qiymət və əlaqə' })
    await user.click(within(panel).getByRole('button', { name: 'WhatsApp-a yaz' }))
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    const [href, target, features] = open.mock.calls[0]
    expect(href).toMatch(/^https:\/\/wa\.me\/994517023314\?text=/)
    expect(decodeURIComponent(String(href).replace(/\+/g, ' '))).toContain(`«${listing.title}»`)
    expect([target, features]).toEqual(['_blank', 'noopener,noreferrer'])
    // The number stays hidden; the button became the link (a second click works where a browser blocked the tab).
    expect(within(panel).queryByRole('link', { name: /Zəng et/ })).not.toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'WhatsApp-a yaz' })).toHaveAttribute('href', href)
  })

  it('keeps the button when the number could not be fetched', async () => {
    const user = userEvent.setup()
    actions.listing.mockResolvedValue({ ok: false })
    const { listing, seller } = await publicListing('zeytun-agaci')
    render(
      <AppStoreProvider>
        <ListingDetail listing={listing} seller={seller} others={[]} similar={[]} />
      </AppStoreProvider>,
    )
    const panel = screen.getByRole('complementary', { name: 'Qiymət və əlaqə' })
    await user.click(within(panel).getByRole('button', { name: 'Nömrəni göstər' }))
    await waitFor(() => expect(actions.listing).toHaveBeenCalled())
    expect(within(panel).getByRole('button', { name: 'Nömrəni göstər' })).toBeInTheDocument()
    expect(within(panel).queryByRole('link', { name: /Zəng et/ })).not.toBeInTheDocument()
  })

  it('shows the owner their own number without asking', async () => {
    const user = userEvent.setup()
    const listing = listingById('zeytun-agaci')!
    render(
      <AppStoreProvider>
        <ListingDetail listing={listing} seller={sellerById(listing.sellerId)} others={[]} similar={[]} mode="owner" />
      </AppStoreProvider>,
    )
    const panel = screen.getByRole('complementary', { name: 'Qiymət və əlaqə' })
    await user.click(within(panel).getByRole('button', { name: 'Nömrəni göstər' }))
    expect(within(panel).getByRole('link', { name: 'Zəng et: 050 555 12 34' })).toBeInTheDocument()
    expect(actions.listing).not.toHaveBeenCalled()
  })
})

describe('seller page contact', () => {
  it('asks for the business’s number by its seller id', async () => {
    const user = userEvent.setup()
    const seller = (await mockRepository.getSeller('abseron-tingcilik'))!
    render(
      <RevealProvider target={{ kind: 'seller', id: seller.id }}>
        <SellerContactButtons seller={seller} />
      </RevealProvider>,
    )
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nömrəni göstər' }))
    expect(await screen.findByRole('link', { name: 'Zəng et: 050 555 12 34' })).toHaveAttribute('href', 'tel:+994505551234')
    expect(actions.seller).toHaveBeenCalledWith('abseron-tingcilik')
    expect(screen.getByRole('link', { name: 'WhatsApp-a yaz' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/994505551234\?text=/)
  })

  it('says so when the business has no number', () => {
    const seller = { ...sellerById('abseron-tingcilik')!, phone: undefined, phoneMasked: undefined }
    render(<SellerContactButtons seller={seller} />)
    expect(screen.getByText('Əlaqə nömrəsi göstərilmir.')).toBeInTheDocument()
  })

  it('renders the whole page from public reads without a number', async () => {
    const seller = (await mockRepository.getSeller('abseron-tingcilik'))!
    const [listings, services] = await Promise.all([loadSellerListings(mockRepository, seller.id), mockRepository.listProviderServices(seller.id)])
    expect(listings.length).toBeGreaterThan(0)
    const { container } = render(
      <AppStoreProvider>
        <SellerPage seller={seller} listings={listings} listingQuery="" services={services} />
      </AppStoreProvider>,
    )
    noNumberIn(container.innerHTML)
    expect(screen.getByRole('heading', { name: 'Elanlar' })).toBeInTheDocument()
    expect(screen.getByText('Zeytun ağacı — Olea europaea')).toBeInTheDocument()
  })
})

describe('service page contact', () => {
  it('asks for the provider’s number through the service', async () => {
    const user = userEvent.setup()
    render(
      <RevealProvider target={{ kind: 'listing', id: 'landsaft-dizayni' }}>
        <ServiceContact title="Landşaft dizaynı" provider={{ id: 'yasil-mekan-landsaft', name: 'Yaşıl Məkan Landşaft' }} serviceId="landsaft-dizayni" categoryId="landsaft-dizayni" />
      </RevealProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Nömrəni göstər' }))
    expect(await screen.findByRole('link', { name: /^Zəng et: 0\d\d \d{3} \d\d \d\d$/ })).toBeInTheDocument()
    expect(actions.listing).toHaveBeenCalledWith('landsaft-dizayni')
  })

  it('renders the page with the provider’s business page and names, without a number', async () => {
    const service = (await mockRepository.getService('landsaft-dizayni-ve-yasillasdirma'))!
    const provider = await mockRepository.getServiceProvider(service.providerId)
    const related = await mockRepository.getRelatedServices(service)
    const seller = provider?.sellerId ? await mockRepository.getSellerById(provider.sellerId) : undefined
    const providerNames = await loadProviderNames(mockRepository, [...related.fromProvider, ...related.similar])
    const { container } = render(
      <AppStoreProvider>
        <ServiceDetailPage service={service} provider={provider} seller={seller} others={related.fromProvider} similar={related.similar} providerNames={providerNames} />
      </AppStoreProvider>,
    )
    noNumberIn(container.innerHTML)
    expect(screen.getAllByRole('link', { name: 'Səhifəsinə bax' })[0]).toHaveAttribute('href', '/saticilar/yasil-mekan-landsaft')
    expect(providerNames).toMatchObject({ 'yasil-mekan-landsaft': 'Yaşıl Məkan Landşaft', aquabag: 'AquaBağ' })
  })
})
