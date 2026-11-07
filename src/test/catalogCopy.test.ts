import { describe, expect, it } from 'vitest'
import { catalogCopy } from '@/app/(main)/elanlar/catalog'
import { productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { listings } from '@/data/listings'
import { sellers } from '@/data/sellers'
import { services } from '@/data/services'
import { parseSearchState, searchHeading } from '@/features/search/searchState'

const state = (query: string) => parseSearchState(new URLSearchParams(query))

describe('catalogue headings', () => {
  it('names the page in the words of the link that led there', () => {
    expect(searchHeading(state(''))).toBe('Məhsullar')
    expect(searchHeading(state('kateqoriya=agaclar'))).toBe('Ağaclar')
    expect(searchHeading(state('kateqoriya=agaclar&alt=meyve-agaclari'))).toBe('Meyvə ağacları')
    expect(searchHeading(state('kateqoriya=agaclar&seher=baki'))).toBe('Bakıda ağaclar')
    expect(searchHeading(state('kateqoriya=guller&seher=gence'))).toBe('Gəncədə güllər və çiçəklər')
    expect(searchHeading(state('seher=quba'))).toBe('Qubada məhsullar')
    expect(searchHeading(state('vip=1'))).toBe('Önə çıxan elanlar')
    expect(searchHeading(state('q=zeytun&kateqoriya=agaclar'))).toBe('«zeytun» üzrə elanlar')
    // Several cities (older links) do not go into the heading; their chip shows them.
    expect(searchHeading(state('kateqoriya=agaclar&seher=baki,abseron'))).toBe('Ağaclar')
  })
})

describe('catalogue page titles', () => {
  // The root layout appends « — GreenStore» to every one of these.
  const indexable = [
    { path: '/elanlar', query: '' },
    ...productCategories.flatMap((c) => [
      { path: `/kateqoriyalar/${c.id}`, query: `kateqoriya=${c.id}` },
      ...cities.map((city) => ({ path: `/kateqoriyalar/${c.id}/${city.id}`, query: `kateqoriya=${c.id}&seher=${city.id}` })),
    ]),
  ]
  const titles = indexable.map(({ query }) => catalogCopy(state(query), 10, 1).title)

  it('gives every indexable catalogue page its own title', () => {
    expect(new Set(titles).size).toBe(titles.length)
    expect(titles.slice(0, 3)).toEqual(['Məhsullar', 'Ağaclar', 'Bakıda ağaclar'])
  })

  it('does not share a title with a listing, seller or service page, and pages 2+ say so', () => {
    const others = new Set([...listings.map((l) => l.title), ...sellers.map((s) => s.name), ...services.map((s) => s.title), 'Landşaft və bağçılıq xidmətləri'])
    expect(titles.filter((t) => others.has(t))).toEqual([])
    expect(catalogCopy(state('kateqoriya=agaclar'), 40, 2).title).toBe('Ağaclar — səhifə 2')
  })
})
