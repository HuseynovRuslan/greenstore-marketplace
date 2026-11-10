import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { CardImage } from '@/components/cards/CardImage'
import { ListingCard } from '@/components/cards/ListingCard'
import { listings } from '@/data/listings'
import { LONG_QUERY, worstCaseCategories, worstCaseSearch } from '@/dev/worstCase'
import { HeroCategories } from '@/features/home/HeroCategories'
import { loadHeroCounts } from '@/features/home/heroCounts'
import { HeroSearchCard } from '@/features/home/HeroSearchCard'
import { mockRepository } from '@/services/mockRepository'
import { CatalogSearchCard } from '@/features/search/CatalogSearchCard'
import { PriceFields } from '@/features/search/FilterControls'
import { QUERY_MAX } from '@/features/search/filterDefs'
import { ActiveFilterRow } from '@/features/search/SearchControls'
import { activeChips } from '@/features/search/searchState'
import { AppStoreProvider } from '@/state/store'

const heroCounts = await loadHeroCounts(mockRepository)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

afterEach(() => vi.unstubAllGlobals())

describe('worst-case fixes', () => {
  it('keeps a long search word inside its chip: the label truncates, the × stays', () => {
    render(<ActiveFilterRow chips={activeChips(worstCaseSearch)} filterCount={9} onRemove={() => {}} onReset={() => {}} fallbackFocusId="h" />)
    const chip = screen.getByRole('button', { name: `«${LONG_QUERY}» axtarış sözünü sil` })
    expect(chip).toHaveClass('max-w-full')
    expect(within(chip).getByText(`«${LONG_QUERY}»`)).toHaveClass('min-w-0', 'truncate')
    expect(chip.querySelector('svg')).toHaveClass('shrink-0')
  })

  it(`stops the search fields at ${QUERY_MAX} characters`, () => {
    const { unmount } = render(
      <AppStoreProvider>
        <HeroSearchCard counts={heroCounts} />
      </AppStoreProvider>,
    )
    expect(screen.getByRole('searchbox', { name: 'Axtarış sözü' })).toHaveAttribute('maxLength', String(QUERY_MAX))
    unmount()
    render(<CatalogSearchCard q="" cityIds={[]} query="" onSearch={() => {}} />)
    expect(screen.getByRole('searchbox', { name: 'Axtarış sözü' })).toHaveAttribute('maxLength', String(QUERY_MAX))
  })

  it('keeps the photo box and shows a placeholder when the photo fails', () => {
    const { container } = render(<CardImage src="/foto-yoxdur.jpg" className="aspect-square" />)
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('alt', '')
    expect(container.firstElementChild).toHaveClass('aspect-square', 'bg-mint')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.firstElementChild).toHaveClass('aspect-square', 'bg-mint')
  })

  it('gives phone cards two title lines', () => {
    render(
      <AppStoreProvider>
        <ListingCard listing={listings[0]} />
      </AppStoreProvider>,
    )
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('line-clamp-2')
    expect(screen.getByRole('heading', { level: 3 }).className).not.toMatch(/line-clamp-1/)
  })

  it('puts the sidebar price fields on two rows, without the dash', () => {
    const { container, rerender } = render(<PriceFields value={{ min: '1000000', max: '9999999' }} onChange={() => {}} errorId="e" />)
    expect(container.textContent).toContain('–')
    rerender(<PriceFields value={{ min: '1000000', max: '9999999' }} onChange={() => {}} errorId="e" stacked />)
    const fields = screen.getAllByRole('textbox')
    expect(fields).toHaveLength(2)
    expect(fields[0].closest('label')).toHaveClass('w-full')
    expect(fields[0].closest('label')?.parentElement).toHaveClass('flex-col')
    expect(container.querySelector('[aria-hidden].text-muted')?.textContent).not.toBe('–')
  })

  it('lets a long category word break inside its item and names clamped ones in full', () => {
    render(<HeroCategories items={worstCaseCategories(heroCounts.categories)} />)
    const name = screen.getByText('Dekorativ iynəyarpaqlılar')
    expect(name).toHaveClass('wrap-anywhere', 'line-clamp-2')
    expect(name.parentElement).toHaveClass('max-w-40', 'min-w-0')
    expect(name).toHaveAttribute('title', 'Dekorativ iynəyarpaqlılar')
  })

  it('re-measures the tab underline when a tab label changes size', () => {
    const observed: Element[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(el: Element) {
          observed.push(el)
        }
        disconnect() {}
      },
    )
    render(
      <AppStoreProvider>
        <HeroSearchCard counts={heroCounts} />
      </AppStoreProvider>,
    )
    const labels = within(screen.getByRole('group', { name: 'Elan növü' })).getAllByRole('radio').map((r) => r.closest('label'))
    expect(labels).toHaveLength(3)
    for (const label of labels) expect(observed).toContain(label)
  })
})
