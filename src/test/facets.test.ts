import { describe, expect, it } from 'vitest'
import { productCategories } from '@/data/categories'
import { countCatalog } from '@/features/search/countAction'
import { getFacetCounts, getRemovalCounts } from '@/features/search/facets'
import { activeChips, parseSearchState, runSearch } from '@/features/search/searchState'

const state = (query: string) => parseSearchState(new URLSearchParams(query))

describe('catalogue counts', () => {
  it('counts each category with the other filters kept', async () => {
    const s = state('seher=baki&catdirilma=1')
    const facets = await getFacetCounts(s)
    expect(facets.categories.all).toBe(runSearch(s).length)
    for (const c of productCategories) expect(facets.categories.byId[c.id], c.id).toBe(runSearch({ ...s, categoryId: c.id }).length)
    expect(facets.subcategories).toEqual({})
  })

  it('counts sub-categories of the chosen category and cities without the city filter', async () => {
    const s = state('kateqoriya=agaclar&seher=baki')
    const facets = await getFacetCounts(s)
    expect(Object.keys(facets.subcategories)).toEqual(['agaclar-meyve', 'agaclar-enliyarpaqli-yarpaqtoken', 'agaclar-enliyarpaqli-hemiseyasil', 'agaclar-iyneyarpaqli'])
    expect(facets.cities.all).toBe(runSearch({ ...s, cityIds: [] }).length)
    expect(facets.cities.byCity.baki).toBe(runSearch(s).length)
  })

  it('counts what removing each chip leaves', async () => {
    const s = state('q=zeytun&max=100')
    const counts = await getRemovalCounts(activeChips(s))
    expect(counts).toEqual({ q: runSearch({ ...s, q: '' }).length, price: runSearch({ ...s, max: '' }).length })
  })

  it('serves the sheet count for a draft query and refuses oversized input', async () => {
    expect(await countCatalog('kateqoriya=agaclar')).toBe(runSearch(state('kateqoriya=agaclar')).length)
    expect(await countCatalog('x'.repeat(2000))).toBe(0)
  })
})

describe('«Kök sistemi» filter', () => {
  it('reads `kok`, filters on the plant facts and shows a chip', () => {
    const s = state('kateqoriya=kollar&kok=torpaq-kuresi')
    expect(s.root).toBe('torpaq-kuresi')
    const found = runSearch(s)
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((l) => l.plant?.rootSystem === 'rootball')).toBe(true)
    expect(activeChips(s).map((c) => c.label)).toEqual(['Kollar', 'Torpaq kürəsi ilə'])
    expect(state('kok=yox').root).toBe('')
  })

  it('has listings for every option in Ağaclar and Kollar', () => {
    for (const categoryId of ['agaclar', 'kollar']) {
      for (const kok of ['dibcek', 'torpaq-kuresi', 'aciq-kok']) expect(runSearch(state(`kateqoriya=${categoryId}&kok=${kok}`)).length, `${categoryId} ${kok}`).toBeGreaterThan(0)
    }
  })
})
