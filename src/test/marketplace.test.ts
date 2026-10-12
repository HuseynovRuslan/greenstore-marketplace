import { describe, expect, it } from 'vitest'
import { searchListings } from '@/services/marketplace'
import { publicListings } from '@/data/listings'

const titles = (ls: { title: string }[]) => ls.map((l) => l.title)

describe('searchListings', () => {
  it('reproduces the Figma "Məhsul axtarışı" result set and order', () => {
    const result = searchListings({ categoryId: 'agaclar', cityIds: ['baki', 'abseron'], minPrice: 30, maxPrice: 180, deliveryOnly: true })
    expect(titles(result)).toEqual([
      'Zeytun ağacı — Olea europaea',
      'Mavi küknar — Picea pungens',
      'Qaraçöhrə — Taxus baccata',
      'Tuya — Smaragd',
      'İtalyan şamı',
      'Dəfnə ağacı',
    ])
  })

  it('only exposes public (active) listings', () => {
    expect(searchListings({}).length).toBe(publicListings.length)
    expect(searchListings({}).every((l) => l.status === 'active')).toBe(true)
  })

  it('matches queries without Azerbaijani diacritics', () => {
    expect(titles(searchListings({ q: 'zeytun agaci' }))).toEqual(['Zeytun ağacı — Olea europaea'])
    expect(titles(searchListings({ q: 'qaracohre' }))).toEqual(['Qaraçöhrə — Taxus baccata'])
  })

  it('filters by price, VIP and seller type', () => {
    expect(searchListings({ minPrice: 100 }).every((l) => l.price >= 100)).toBe(true)
    expect(titles(searchListings({ vipOnly: true }))).toEqual(['Zeytun ağacı — Olea europaea', 'Mavi küknar — Picea pungens', 'Yapon ağcaqayını'])
    expect(searchListings({ sellerType: 'business' }).every((l) => l.sellerId === 'abseron-tingcilik')).toBe(true)
  })

  it('filters by height and age parsed from the card attributes', () => {
    const tall = searchListings({ heightMin: 150 })
    expect(titles(tall)).toEqual(expect.arrayContaining(['Zeytun ağacı — Olea europaea', 'İtalyan şamı']))
    expect(tall.some((l) => l.title === 'Dəfnə ağacı')).toBe(false)
    expect(searchListings({ ageMin: 5 }).every((l) => /5 yaş/.test(l.attributes.join(' ')))).toBe(true)
  })

  it('sorts by price', () => {
    const asc = searchListings({}, 'price-asc').map((l) => l.price)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
    const desc = searchListings({}, 'price-desc').map((l) => l.price)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
  })
})
