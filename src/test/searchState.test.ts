import { describe, expect, it } from 'vitest'
import { activeChips, activeFilterCount, emptySearchState, parseSearchState, writeSearchState } from '@/features/search/searchState'

const state = (query: string) => parseSearchState(new URLSearchParams(query))
const labels = (query: string) => activeChips(state(query)).map((c) => c.label)

describe('catalogue chips', () => {
  it('shows a home search on /elanlar with the home labels, in page order', () => {
    expect(labels('q=zeytun&seher=baki&kateqoriya=agaclar&min=50&max=150&hundurluk=100-200&catdirilma=1')).toEqual([
      '«zeytun»',
      'Bakı',
      'Ağaclar',
      '50–150 ₼',
      '1–2 m',
      'Çatdırılma',
    ])
  })

  it('gives delivery, seller, age and «Önə çıxanlar» their own chips', () => {
    expect(labels('max=100&yas=5-&saticiNovu=biznes&vip=1')).toEqual(['100 ₼-a qədər', '5 yaşdan yuxarı', 'Biznes satıcılar', 'Önə çıxanlar'])
    const delivery = activeChips(state('catdirilma=1'))[0]
    expect(delivery.without).toEqual(emptySearchState)
  })

  it('counts filters without the search word', () => {
    expect(activeFilterCount(state('q=zeytun'))).toBe(0)
    expect(activeFilterCount(state('q=zeytun&kateqoriya=agaclar&catdirilma=1'))).toBe(2)
  })

  it('keeps older links working: cm height ranges and several cities', () => {
    const old = state('hundurluk=80-200&seher=abseron,baki')
    expect(old.height).toBe('80-200')
    expect(old.cityIds).toEqual(['baki', 'abseron'])
    expect(activeChips(old).map((c) => c.label)).toEqual(['Bakı, Abşeron', '80–200 sm'])
  })

  it('writes the same params back, keeping sort and view', () => {
    const query = 'q=zeytun&kateqoriya=agaclar&seher=baki&min=50&hundurluk=100-200&catdirilma=1&saticiNovu=ferdi'
    const current = new URLSearchParams(`${query}&siralama=ucuz&gorunus=siyahi&sehife=2`)
    expect(writeSearchState(state(query), current).toString()).toBe(`${query}&siralama=ucuz&gorunus=siyahi`)
  })
})
