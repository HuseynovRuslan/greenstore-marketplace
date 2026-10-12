import { services } from '@/data/services'
import { filterServices, pageWindow, paginate, parseServiceQuery, searchServices, sortServices } from './query'

const q = (s: string) => parseServiceQuery(new URLSearchParams(s))

describe('services query', () => {
  it('parses URL params and ignores unknown values', () => {
    expect(q('')).toMatchObject({ q: '', tab: 'all', sort: 'newest', page: 1, categoryId: undefined, cityId: undefined })
    expect(q('kateqoriya=bag-baximi&erazi=baki&nov=sirketler&siralama=price-asc&sehife=2')).toMatchObject({
      categoryId: 'bag-baximi',
      cityId: 'baki',
      tab: 'sirketler',
      sort: 'price-asc',
      page: 2,
    })
    // home hero sends `seher` (city id) and the umbrella category
    expect(q('seher=quba&kateqoriya=landsaft-xidmetleri')).toMatchObject({ cityId: 'quba', categoryId: undefined })
    expect(q('nov=x&siralama=y&sehife=-3')).toMatchObject({ tab: 'all', sort: 'newest', page: 1 })
  })

  it('shows the platform total only while nothing is filtered', () => {
    expect(searchServices(q(''))).toMatchObject({ total: 6, displayTotal: 252, active: false })
    expect(searchServices(q('kateqoriya=cim-salinmasi'))).toMatchObject({ total: 1, displayTotal: 1, active: true })
  })

  it('filters by text, category, area, provider type and price', () => {
    const ids = (s: string) => filterServices(services, q(s)).map((x) => x.id)
    expect(ids('q=cim')).toEqual(['landsaft-dizayni', 'cim-salinmasi'])
    expect(ids('q=Yaşıl Məkan')).toEqual(['landsaft-dizayni', 'cim-salinmasi'])
    expect(ids('kateqoriya=bag-baximi')).toEqual(['movsumi-bag-baximi'])
    expect(ids('erazi=quba')).toEqual(['heyetyani-yasillasdirma'])
    expect(ids('erazi=sumqayit')).toEqual(['landsaft-dizayni', 'cim-salinmasi'])
    expect(ids('nov=sirketler')).toEqual(['landsaft-dizayni', 'cim-salinmasi', 'agac-ekilmesi'])
    expect(ids('nov=ustalar')).toEqual([])
    expect(ids('min=20&max=200')).toEqual(['landsaft-dizayni', 'movsumi-bag-baximi', 'heyetyani-yasillasdirma'])
    expect(ids('erazi=gence')).toEqual([])
  })

  it('sorts by priceFrom with "Razılaşma yolu ilə" last', () => {
    expect(sortServices(services, 'price-asc').map((s) => s.priceFrom)).toEqual([8, 20, 25, 150, 350, undefined])
    expect(sortServices(services, 'price-desc').map((s) => s.priceFrom)).toEqual([350, 150, 25, 20, 8, undefined])
    expect(sortServices(services, 'newest')).toEqual(services)
  })

  it('paginates and windows page numbers', () => {
    const items = Array.from({ length: 15 }, (_, i) => i)
    expect(paginate(items, 1)).toEqual({ items: [0, 1, 2, 3, 4, 5], page: 1, pageCount: 3 })
    expect(paginate(items, 3).items).toEqual([12, 13, 14])
    expect(paginate(items, 9).page).toBe(3)
    expect(paginate([], 1)).toEqual({ items: [], page: 1, pageCount: 1 })
    expect(pageWindow(1, 42)).toEqual([1, 2, 3])
    expect(pageWindow(5, 42)).toEqual([4, 5, 6])
    expect(pageWindow(42, 42)).toEqual([40, 41, 42])
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(2, 2)).toEqual([1, 2])
  })
})
