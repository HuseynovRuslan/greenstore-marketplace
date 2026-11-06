import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CatalogResults } from '@/features/search/CatalogResults'
import { activeChips, parseSearchState } from '@/features/search/searchState'
import { AppStoreProvider } from '@/state/store'

const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/elanlar',
  useSearchParams: () => new URLSearchParams(),
}))

const facets = {
  categories: { all: 16, byId: { agaclar: 9, kollar: 2 } },
  subcategories: { 'meyve-agaclari': 3 },
  cities: { all: 16, byCity: { baki: 5 } },
}

function renderCatalog(query: string, total = 6) {
  const state = parseSearchState(new URLSearchParams(query))
  render(
    <AppStoreProvider>
      <CatalogResults
        state={state}
        stateQuery={query}
        basePath="/elanlar"
        urlQuery={query}
        sort="newest"
        view="grid"
        total={total}
        heading="Ağaclar"
        chips={activeChips(state)}
        facets={facets}
        speciesOptions={[{ value: 'zeytun-agaci', label: 'Zeytun ağacı' }]}
        showPlantFilters
        breadcrumb={null}
        results={<ul />}
      />
    </AppStoreProvider>,
  )
}

const sidebar = () => screen.getByRole('complementary', { name: 'Filtrlər' })

describe('CatalogResults', () => {
  beforeEach(() => {
    push.mockClear()
    replace.mockClear()
  })

  it('shows the count once, next to the heading', () => {
    renderCatalog('kateqoriya=agaclar')
    expect(screen.getByRole('heading', { level: 1, name: 'Ağaclar' })).toBeInTheDocument()
    expect(screen.getAllByText('6 elan')).toHaveLength(1)
  })

  it('applies a sidebar change at once and adds a history entry', async () => {
    const user = userEvent.setup()
    renderCatalog('kateqoriya=agaclar&siralama=ucuz')
    await user.click(within(sidebar()).getByRole('button', { name: '1–2 m' }))
    expect(push).toHaveBeenCalledWith('/elanlar?kateqoriya=agaclar&hundurluk=100-200&siralama=ucuz', { scroll: false })
    // Categories are links with counts; the chosen one is marked.
    const trees = within(sidebar()).getByRole('link', { name: /Ağaclar/ })
    expect(trees).toHaveAttribute('aria-current', 'true')
    expect(trees).toHaveTextContent('9')
    await user.click(within(sidebar()).getByRole('link', { name: /Kollar/ }))
    expect(push).toHaveBeenLastCalledWith('/elanlar?kateqoriya=kollar&siralama=ucuz', { scroll: false })
  })

  it('removes a chip, and «Sıfırla» keeps the search word', async () => {
    const user = userEvent.setup()
    renderCatalog('q=zeytun&kateqoriya=agaclar&catdirilma=1')
    const row = screen.getByRole('group', { name: 'Seçilmiş filtrlər' })
    expect(within(row).getAllByRole('button').map((b) => b.textContent)).toEqual(['«zeytun»', 'Ağaclar', 'Çatdırılma', 'Sıfırla'])
    await user.click(within(row).getByRole('button', { name: 'Çatdırılma filtrini sil' }))
    expect(push).toHaveBeenLastCalledWith('/elanlar?q=zeytun&kateqoriya=agaclar', { scroll: false })
    await user.click(within(row).getByRole('button', { name: 'Sıfırla' }))
    expect(push).toHaveBeenLastCalledWith('/elanlar?q=zeytun', { scroll: false })
  })

  it('changes sort and view without a new history entry, back to page 1', async () => {
    const user = userEvent.setup()
    renderCatalog('kateqoriya=agaclar&sehife=2')
    const sort = screen.getAllByRole('combobox', { name: 'Sıralama' }).find((el) => el.tagName === 'SELECT')!
    await user.selectOptions(sort, 'price-desc')
    expect(replace).toHaveBeenCalledWith('/elanlar?kateqoriya=agaclar&siralama=baha', { scroll: false })
    await user.click(screen.getAllByRole('button', { name: 'Siyahı' })[0])
    expect(replace).toHaveBeenLastCalledWith('/elanlar?kateqoriya=agaclar&sehife=2&gorunus=siyahi', { scroll: false })
    expect(push).not.toHaveBeenCalled()
  })

  it('hides sort and view when nothing matches', () => {
    renderCatalog('kateqoriya=agaclar&max=1', 0)
    expect(screen.queryByRole('combobox', { name: 'Sıralama' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Görünüş' })).not.toBeInTheDocument()
  })
})
