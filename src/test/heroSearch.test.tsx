import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeroSearchCard } from '@/features/home/HeroSearchCard'
import {
  activeFilterCount,
  emptyHeroFilters,
  filtersForTab,
  heroSearchUrl,
  SHOW_PENDING_FILTERS,
  visibleFilters,
  type HeroFilters,
} from '@/features/home/heroSearch'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const allSet: HeroFilters = {
  category: 'agaclar',
  min: '50',
  max: '150',
  height: '100-200',
  root: 'dibcek',
  availability: 'satisda',
  delivery: true,
  planting: true,
}

describe('hero search URL', () => {
  it('sends product filters with the /elanlar params and leaves the pending ones out', () => {
    expect(heroSearchUrl({ tab: 'products', q: ' zeytun ağacı ', city: 'baki', filters: allSet })).toBe(
      '/elanlar?q=zeytun+a%C4%9Fac%C4%B1&kateqoriya=agaclar&seher=baki&min=50&max=150&hundurluk=100-200&catdirilma=1',
    )
  })

  it('sends services to /xidmetler without height or delivery', () => {
    const filters = { ...emptyHeroFilters, category: 'cim-salinmasi', max: '50', delivery: true, planting: true }
    expect(heroSearchUrl({ tab: 'services', q: 'çim', city: 'abseron', filters })).toBe('/xidmetler?q=%C3%A7im&kateqoriya=cim-salinmasi&seher=abseron&max=50')
  })

  it('sends «Hamısı» to /elanlar and drops empty values', () => {
    expect(heroSearchUrl({ tab: 'all', q: 'qızılgül', city: '', filters: emptyHeroFilters })).toBe('/elanlar?q=q%C4%B1z%C4%B1lg%C3%BCl')
    expect(heroSearchUrl({ tab: 'all', q: '  ', city: '', filters: emptyHeroFilters })).toBe('/elanlar')
  })
})

describe('hero filter rules', () => {
  const ids = (list: Array<{ id: string }>) => list.map((f) => f.id)

  it('hides the pending filters until the backend has params for them; the flag brings them back', () => {
    expect(SHOW_PENDING_FILTERS).toBe(false)
    expect(ids(visibleFilters('products'))).toEqual(['category', 'price', 'height', 'delivery'])
    expect(ids(visibleFilters('services'))).toEqual(['category', 'price'])
    expect(ids(visibleFilters('products', true))).toEqual(['category', 'price', 'height', 'root', 'availability', 'delivery', 'planting'])
  })

  it('hides Hündürlük and Kök sistemi on Xidmətlər and drops what that tab cannot show', () => {
    expect(ids(visibleFilters('services', true))).toEqual(['category', 'price', 'availability', 'delivery', 'planting'])
    expect(filtersForTab('services', allSet, true)).toEqual({ ...allSet, category: '', height: '', root: '' })
    expect(filtersForTab('all', allSet, true)).toEqual(allSet)
    // With the pending filters hidden, their values are dropped too.
    expect(filtersForTab('all', allSet)).toEqual({ ...allSet, root: '', availability: '', planting: false })
  })

  it('counts only the filters visible on the tab', () => {
    expect(activeFilterCount('products', allSet)).toBe(4)
    expect(activeFilterCount('services', allSet)).toBe(2)
    expect(activeFilterCount('products', allSet, true)).toBe(7)
    expect(activeFilterCount('services', allSet, true)).toBe(5)
    expect(activeFilterCount('all', emptyHeroFilters)).toBe(0)
  })
})

describe('HeroSearchCard', () => {
  beforeEach(() => push.mockClear())

  // Desktop chips and their popovers live in the search form; the phone row and the sheet are outside it.
  const form = () => screen.getByRole('search', { name: 'Elan axtarışı' })
  const chip = (name: string | RegExp) => within(form()).getByRole('button', { name })
  const cityListbox = () => screen.getAllByRole('combobox', { name: 'Şəhər' }).find((el) => el.tagName === 'BUTTON')!

  it('offers the three listing types as one radio group with their counts', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    const group = screen.getByRole('group', { name: 'Elan növü' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((r) => r.closest('label')?.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Hamısı 4 040 elan',
      'Məhsullar 3 945 elan',
      'Xidmətlər 95 elan',
    ])
    expect(within(group).getByRole('radio', { name: /Hamısı/ })).toBeChecked()
    expect(screen.getByRole('searchbox', { name: 'Axtarış sözü' })).toHaveAttribute('placeholder', 'Məsələn, zeytun ağacı')

    await user.click(within(group).getByRole('radio', { name: /Xidmətlər/ }))
    expect(screen.getByRole('searchbox', { name: 'Axtarış sözü' })).toHaveAttribute('placeholder', 'Məsələn, çim salınması')
    expect(within(form()).queryByRole('button', { name: /Hündürlük/ })).not.toBeInTheDocument()
    expect(within(form()).queryByRole('button', { name: /Kök sistemi/ })).not.toBeInTheDocument()
    expect(chip('Qiymət')).toBeInTheDocument()
  })

  it('shows the chosen value in the chip label and returns focus to the chip', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    await user.click(chip('Qiymət'))
    const dialog = screen.getByRole('dialog', { name: 'Qiymət, ₼' })
    expect(within(dialog).getByRole('textbox', { name: 'min. qiymət, ₼' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: '50–150 ₼' }))
    expect(chip('Qiymət: 50–150 ₼')).toHaveFocus()
    expect(chip('Qiymət: 50–150 ₼')).toHaveAttribute('aria-expanded', 'false')

    await user.click(chip('Hündürlük'))
    await user.click(within(form()).getByRole('button', { name: '1–2 m' }))
    expect(chip('Hündürlük: 1–2 m')).toBeInTheDocument()

    // Typed prices update the label as you type
    await user.click(chip('Qiymət: 50–150 ₼'))
    const min = within(form()).getByRole('textbox', { name: 'min. qiymət, ₼' })
    await user.clear(min)
    await user.type(min, '80')
    expect(chip('Qiymət: 80–150 ₼')).toBeInTheDocument()
  })

  it('shows «Sıfırla» once a filter is set and clears every filter with it', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    expect(within(form()).queryByRole('button', { name: 'Sıfırla' })).not.toBeInTheDocument()

    await user.click(chip('Çatdırılma'))
    expect(chip('Çatdırılma')).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip('Kateqoriya'))
    await user.click(within(form()).getByRole('button', { name: 'Ağaclar' }))
    expect(chip('Kateqoriya: Ağaclar')).toBeInTheDocument()

    await user.click(chip('Sıfırla'))
    expect(chip('Kateqoriya')).toHaveFocus()
    expect(chip('Çatdırılma')).toHaveAttribute('aria-pressed', 'false')
    expect(within(form()).queryByRole('button', { name: 'Sıfırla' })).not.toBeInTheDocument()
  })

  it('opens the catalogue with the search, city and supported filters', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    await user.type(screen.getByRole('searchbox', { name: 'Axtarış sözü' }), 'zeytun')
    await user.click(cityListbox())
    await user.click(within(screen.getByRole('listbox', { name: 'Şəhər' })).getByRole('option', { name: /Bakı/ }))
    await user.click(chip('Kateqoriya'))
    await user.click(within(form()).getByRole('button', { name: 'Ağaclar' }))
    expect(within(form()).queryByRole('button', { name: /Kök sistemi|Mövcudluq|Əkin daxil/ })).not.toBeInTheDocument()
    await user.click(chip('Çatdırılma'))
    await user.click(chip('Axtar'))
    expect(push).toHaveBeenCalledWith('/elanlar?q=zeytun&kateqoriya=agaclar&seher=baki&catdirilma=1')
  })

  it('blocks a search whose minimum price is above the maximum', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    await user.click(chip('Qiymət'))
    await user.type(within(form()).getByRole('textbox', { name: 'min. qiymət, ₼' }), '200')
    await user.type(within(form()).getByRole('textbox', { name: 'maks. qiymət, ₼' }), '1a00')
    expect(within(form()).getByRole('textbox', { name: 'maks. qiymət, ₼' })).toHaveValue('100')
    expect(screen.getByRole('alert')).toHaveTextContent('Minimum qiymət maksimumdan böyük ola bilməz.')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(chip('Axtar'))
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Minimum qiymət maksimumdan böyük ola bilməz.')
  })
})

describe('HeroSearchCard on phones', () => {
  beforeEach(() => push.mockClear())

  // In jsdom both layouts are in the DOM; the phone row is the «Filtrlər» group outside the search form.
  const row = () => screen.getAllByRole('group', { name: 'Filtrlər' }).find((g) => !g.closest('form'))!
  const sheet = () => screen.getByRole('dialog', { name: 'Filtrlər' })

  it('opens the «Filtrlər» sheet with every filter of the tab and shows the active count', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    const filtersButton = within(row()).getByRole('button', { name: 'Filtrlər' })
    expect(filtersButton).toHaveAttribute('aria-haspopup', 'dialog')
    // Toggles switch in place
    await user.click(within(row()).getByRole('button', { name: 'Çatdırılma' }))
    expect(within(row()).getByRole('button', { name: 'Çatdırılma' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(row()).getByRole('button', { name: 'Filtrlər (1 filtr seçilib)' })).toBeInTheDocument()

    await user.click(within(row()).getByRole('button', { name: /^Filtrlər/ }))
    expect(within(row()).getByRole('button', { name: /^Filtrlər/ })).toHaveAttribute('aria-expanded', 'true')
    const headings = within(sheet()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['Kateqoriya', 'Qiymət, ₼', 'Bitkinin hündürlüyü', 'Əlavə'])
    await user.click(within(sheet()).getByRole('button', { name: 'Ağaclar' }))
    expect(within(row()).getByRole('button', { name: 'Kateqoriya: Ağaclar' })).toBeInTheDocument()

    await user.click(within(sheet()).getByRole('button', { name: 'Sıfırla' }))
    expect(within(row()).getByRole('button', { name: 'Kateqoriya' })).toBeInTheDocument()
    expect(within(row()).getByRole('button', { name: 'Filtrlər' })).toBeInTheDocument()
  })

  it('opens the sheet at the group of the chip that was tapped', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    await user.click(within(row()).getByRole('button', { name: 'Qiymət' }))
    expect(within(sheet()).getByRole('textbox', { name: 'min. qiymət, ₼' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Filtrlər' })).not.toBeInTheDocument()
    expect(within(row()).getByRole('button', { name: 'Qiymət' })).toHaveFocus()
  })

  it('keeps Tab inside the sheet', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    await user.click(within(row()).getByRole('button', { name: 'Filtrlər' }))
    const search = within(sheet()).getByRole('button', { name: 'Axtar' })
    search.focus()
    await user.tab()
    expect(within(sheet()).getByRole('button', { name: 'Bağla' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(search).toHaveFocus()
  })

  it('searches from the sheet with the chosen filters', async () => {
    const user = userEvent.setup()
    render(<HeroSearchCard />)
    await user.click(within(row()).getByRole('button', { name: 'Filtrlər' }))
    await user.click(within(sheet()).getByRole('button', { name: '150–300 ₼' }))
    await user.click(within(sheet()).getByRole('button', { name: '2–3 m' }))
    await user.click(within(sheet()).getByRole('button', { name: 'Axtar' }))
    expect(push).toHaveBeenCalledWith('/elanlar?min=150&max=300&hundurluk=200-300')
    expect(screen.queryByRole('dialog', { name: 'Filtrlər' })).not.toBeInTheDocument()
  })
})
