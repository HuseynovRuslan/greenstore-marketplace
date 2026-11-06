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
    expect(Object.keys(facets.subcategories)).toEqual(['dekorativ-agaclar', 'meyve-agaclari', 'iyneyarpaqlilar'])
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
