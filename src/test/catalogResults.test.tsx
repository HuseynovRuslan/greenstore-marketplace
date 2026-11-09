import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CatalogResults } from '@/features/search/CatalogResults'
import { activeChips, parseSearchState } from '@/features/search/searchState'
import { AppStoreProvider } from '@/state/store'

const push = vi.fn()
const replace = vi.fn()
// The sheet flows click through the accordion and wait for live recounts: room for a busy parallel run.
vi.setConfig({ testTimeout: 20_000 })
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/elanlar',
  useSearchParams: () => new URLSearchParams(),
}))

const facets = {
  categories: { all: 16, byId: { agaclar: 9, kollar: 2 } },
  subcategories: { 'agaclar-meyve': 3 },
  cities: { all: 16, byCity: { baki: 5 } },
}

function renderCatalog(query: string, total = 6, removalCounts?: Record<string, number>) {
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
        removalCounts={removalCounts}
        facets={facets}
        speciesOptions={[{ value: 'zeytun-agaci', label: 'Zeytun ağacı' }]}
        plantCategoryIds={['agaclar', 'kollar']}
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
    // Categories are links with counts; the chosen one opens its list, where «Bütün ağaclar» is the current row.
    const trees = within(sidebar()).getByRole('link', { name: 'Ağaclar 9 elan' })
    expect(trees).not.toHaveAttribute('aria-current')
    const all = within(sidebar()).getByRole('link', { name: 'Bütün ağaclar 9 elan' })
    expect(all).toHaveAttribute('aria-current', 'page')
    // One list open at a time: the other categories' lists are out of reach until chosen.
    expect(within(sidebar()).queryByRole('link', { name: /^Həmişəyaşıl kollar/ })).not.toBeInTheDocument()
    expect(within(sidebar()).getByRole('link', { name: 'Güllər 0 elan' })).toHaveClass('text-muted')
    await user.click(within(sidebar()).getByRole('link', { name: /^Kollar/ }))
    expect(push).toHaveBeenLastCalledWith('/elanlar?kateqoriya=kollar&siralama=ucuz', { scroll: false })
  })

  it('lists the chosen category’s sub-categories after «Bütün …», and folds them with the chevron', async () => {
    const user = userEvent.setup()
    renderCatalog('kateqoriya=agaclar&alt=agaclar-meyve')
    const sub = within(sidebar()).getByRole('link', { name: 'Meyvə ağacları 3 elan' })
    expect(sub).toHaveAttribute('aria-current', 'page')
    expect(sub).toHaveAttribute('href', '/elanlar?kateqoriya=agaclar&alt=agaclar-meyve')
    // A sub-category without listings is muted but still a link
    expect(within(sidebar()).getByRole('link', { name: 'İynəyarpaqlı ağaclar 0 elan' })).toHaveClass('text-muted')
    // «Bütün ağaclar» is the category itself: it drops the sub-category.
    const all = within(sidebar()).getByRole('link', { name: /^Bütün ağaclar/ })
    expect(all).not.toHaveAttribute('aria-current')
    await user.click(all)
    expect(push).toHaveBeenLastCalledWith('/elanlar?kateqoriya=agaclar', { scroll: false })

    const fold = within(sidebar()).getByRole('button', { name: 'Alt kateqoriyalar — Ağaclar' })
    expect(fold).toHaveAttribute('aria-expanded', 'true')
    await user.click(fold)
    expect(fold).toHaveAttribute('aria-expanded', 'false')
    expect(within(sidebar()).queryByRole('link', { name: /^Meyvə ağacları/ })).not.toBeInTheDocument()
    // Folded, the list leaves the tab order.
    expect(document.getElementById(fold.getAttribute('aria-controls')!)).toHaveAttribute('inert')
    await user.click(fold)
    expect(within(sidebar()).getByRole('link', { name: /^Meyvə ağacları/ })).toHaveAttribute('aria-current', 'page')
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

  it('edits a draft in the «Filtrlər» sheet with a live count, and applies it on «N elanı göstər»', async () => {
    const user = userEvent.setup()
    renderCatalog('', 16)
    await user.click(screen.getByRole('button', { name: 'Filtrlər' }))
    const sheet = screen.getByRole('dialog', { name: 'Filtrlər' })
    expect(within(sheet).getByRole('button', { name: '16 elanı göstər' })).toBeEnabled()
    // The same accordion as the sidebar, as toggle buttons; «Kök sistemi» appears for Kollar.
    await user.click(within(sheet).getByRole('button', { name: /^Kollar/ }))
    expect(within(sheet).getByRole('button', { name: /^Kollar/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: 'Alt kateqoriyalar — Kollar' })).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(sheet).getByRole('button', { name: 'Açıq kök' }))
    await user.click(within(sheet).getByRole('button', { name: 'Çatdırılma' }))
    // No bare-root shrub is delivered: the button says so and cannot be pressed; the accordion recounts.
    expect(await within(sheet).findByRole('button', { name: 'Uyğun elan yoxdur' })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: /^Yarpaqtökən kollar/ })).toHaveTextContent('0')
    await user.click(within(sheet).getByRole('button', { name: /^Ağaclar/ }))
    const show = await within(sheet).findByRole('button', { name: /^\d+ elanı göstər$/ })
    expect(push).not.toHaveBeenCalled()
    await user.click(show)
    expect(push).toHaveBeenCalledWith('/elanlar?kateqoriya=agaclar&kok=aciq-kok&catdirilma=1', { scroll: false })
    expect(screen.queryByRole('dialog', { name: 'Filtrlər' })).not.toBeInTheDocument()
  })

  it('dims the sheet count while it is redone, then lets the new number blur in', async () => {
    const user = userEvent.setup()
    renderCatalog('', 16)
    await user.click(screen.getByRole('button', { name: 'Filtrlər' }))
    const sheet = screen.getByRole('dialog', { name: 'Filtrlər' })
    const count = () => within(within(sheet).getByRole('button', { name: /elanı göstər$/ })).getByText(/^[\d ]+$/)
    expect(count()).toHaveClass('opacity-100')
    expect(count()).not.toHaveClass('motion-safe:animate-count-in')
    await user.click(within(sheet).getByRole('button', { name: 'Çatdırılma' }))
    expect(count()).toHaveClass('opacity-50', 'delay-150')
    await waitFor(() => expect(count()).toHaveClass('opacity-100'))
    expect(count()).toHaveClass('motion-safe:animate-count-in')
  })

  it('drops the draft when the sheet is closed', async () => {
    const user = userEvent.setup()
    renderCatalog('', 16)
    await user.click(screen.getByRole('button', { name: 'Filtrlər' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Filtrlər' })).getByRole('button', { name: /^Ağaclar/ }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Filtrlər' }))
    expect(within(screen.getByRole('dialog', { name: 'Filtrlər' })).getByRole('button', { name: /^Ağaclar/ })).toHaveAttribute('aria-pressed', 'false')
    expect(push).not.toHaveBeenCalled()
  })

  it('offers the filters whose removal brings listings back when nothing matches', async () => {
    const user = userEvent.setup()
    renderCatalog('q=zeytun&kateqoriya=kollar&max=100', 0, { q: 2, category: 4, price: 0 })
    expect(screen.getByRole('heading', { name: 'Bu seçimə uyğun elan yoxdur' })).toBeInTheDocument()
    const suggestions = screen.getAllByRole('button', { name: /olmadan/ }).map((b) => b.textContent)
    expect(suggestions).toEqual(['«Kollar» olmadan: 4 elan', '«zeytun» olmadan: 2 elan'])
    await user.click(screen.getByRole('button', { name: '«Kollar» olmadan: 4 elan' }))
    expect(push).toHaveBeenLastCalledWith('/elanlar?q=zeytun&max=100', { scroll: false })
    await user.click(screen.getByRole('button', { name: 'Filtrləri sıfırla' }))
    expect(push).toHaveBeenLastCalledWith('/elanlar?q=zeytun', { scroll: false })
  })

  it('leads to every listing when only the search word finds nothing', async () => {
    const user = userEvent.setup()
    renderCatalog('q=palma', 0, { q: 16 })
    await user.click(screen.getByRole('button', { name: 'Bütün elanlara bax' }))
    expect(push).toHaveBeenLastCalledWith('/elanlar', { scroll: false })
  })
})
