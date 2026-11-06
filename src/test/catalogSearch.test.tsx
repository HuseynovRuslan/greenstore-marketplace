import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { CatalogSearchCard } from '@/features/search/CatalogSearchCard'
import { AppStoreProvider } from '@/state/store'

let pathname = '/elanlar'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}))

const renderHeader = (path: string) => {
  pathname = path
  return render(
    <AppStoreProvider>
      <SiteHeader />
    </AppStoreProvider>,
  )
}

describe('header on catalogue pages', () => {
  it.each(['/elanlar', '/kateqoriyalar/agaclar', '/kateqoriyalar/agaclar/baki'])('%s gets the home header with «Məhsullar» marked', (path) => {
    renderHeader(path)
    const nav = screen.getByRole('navigation', { name: 'Əsas bölmələr' })
    expect(within(nav).getByRole('link', { name: 'Məhsullar' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Xidmətlər' })).not.toHaveAttribute('aria-current')
    // One search per page: the catalogue's own search card, no header search field.
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('gives /xidmetler the home header with «Xidmətlər» marked and no header search', () => {
    renderHeader('/xidmetler')
    const nav = screen.getByRole('navigation', { name: 'Əsas bölmələr' })
    expect(within(nav).getByRole('link', { name: 'Xidmətlər' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Məhsullar' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('keeps the default header with its search on a listing page', () => {
    renderHeader('/elanlar/zeytun-agaci-olea-europaea')
    expect(screen.queryByRole('navigation', { name: 'Əsas bölmələr' })).not.toBeInTheDocument()
    expect(screen.getByRole('search')).toBeInTheDocument()
  })
})

describe('CatalogSearchCard', () => {
  const onSearch = vi.fn()
  beforeEach(() => onSearch.mockClear())

  it('searches with the word and one city', async () => {
    const user = userEvent.setup()
    render(<CatalogSearchCard q="" cityIds={[]} query="kateqoriya=agaclar" onSearch={onSearch} />)
    const field = screen.getByRole('searchbox', { name: 'Axtarış sözü' })
    expect(field).toHaveAttribute('placeholder', 'Məsələn, zeytun ağacı')
    await user.type(field, ' zeytun ')
    const city = screen.getAllByRole('combobox', { name: 'Şəhər' }).find((el) => el.tagName === 'BUTTON')!
    await user.click(city)
    await user.click(within(screen.getByRole('listbox', { name: 'Şəhər' })).getByRole('option', { name: /Bakı/ }))
    await user.click(screen.getByRole('button', { name: 'Axtar' }))
    expect(onSearch).toHaveBeenCalledWith('zeytun', ['baki'])
  })

  it('keeps several cities from an older link as one option', async () => {
    const user = userEvent.setup()
    render(<CatalogSearchCard q="tuya" cityIds={['baki', 'abseron']} query="" onSearch={onSearch} />)
    const select = screen.getAllByRole('combobox', { name: 'Şəhər' }).find((el) => el.tagName === 'SELECT') as HTMLSelectElement
    expect(select.selectedOptions[0]).toHaveTextContent('Bakı, Abşeron')
    await user.click(screen.getByRole('button', { name: 'Axtar' }))
    expect(onSearch).toHaveBeenCalledWith('tuya', ['baki', 'abseron'])
  })

  it('sends the other filters along when the form is posted without JavaScript', () => {
    const { container } = render(<CatalogSearchCard q="" cityIds={[]} query="kateqoriya=agaclar&q=x&seher=baki&sehife=2&catdirilma=1" onSearch={onSearch} />)
    const hidden = [...container.querySelectorAll<HTMLInputElement>('input[type=hidden]')].map((i) => `${i.name}=${i.value}`)
    expect(hidden).toEqual(['kateqoriya=agaclar', 'catdirilma=1'])
  })
})
