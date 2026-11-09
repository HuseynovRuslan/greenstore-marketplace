import { describe, expect, it } from 'vitest'
import { searchListings } from '@/services/marketplace'
import { ageYears, publicListings } from '@/data/listings'
import { sellerById } from '@/data/sellers'

const titles = (ls: { title: string }[]) => ls.map((l) => l.title)

describe('searchListings', () => {
  it('reproduces the Figma "Məhsul axtarışı" result set and order, demo listings after it', () => {
    const result = searchListings({ categoryId: 'agaclar', cityIds: ['baki', 'abseron'], minPrice: 30, maxPrice: 180, deliveryOnly: true })
    expect(titles(result)).toEqual([
      'Zeytun ağacı — Olea europaea',
      'Mavi küknar — Picea pungens',
      'Qaraçöhrə — Taxus baccata',
      'Tuya — Smaragd',
      'İtalyan şamı',
      'Dəfnə ağacı',
      // A November 2026 demo listing (src/data/demoListings.ts): older, so it follows the photographed ones.
      'Daş palıd — Quercus ilex',
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
    expect(titles(searchListings({ vipOnly: true }))).toEqual(['Limon ağacı', 'Zeytun ağacı — Olea europaea', 'Mavi küknar — Picea pungens', 'Yapon ağcaqayını'])
    const business = searchListings({ sellerType: 'business' })
    expect(business.length).toBeGreaterThan(0)
    expect(business.every((l) => sellerById(l.sellerId)?.type === 'business')).toBe(true)
  })

  it('filters by height and age parsed from the card attributes', () => {
    const tall = searchListings({ heightMin: 150 })
    expect(titles(tall)).toEqual(expect.arrayContaining(['Zeytun ağacı — Olea europaea', 'İtalyan şamı']))
    expect(tall.some((l) => l.title === 'Dəfnə ağacı')).toBe(false)
    const old = searchListings({ ageMin: 5 })
    expect(old.length).toBeGreaterThan(0)
    expect(old.every((l) => (ageYears(l) ?? 0) >= 5)).toBe(true)
  })

  it('sorts by price', () => {
    const asc = searchListings({}, 'price-asc').map((l) => l.price)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
    const desc = searchListings({}, 'price-desc').map((l) => l.price)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
  })
})
