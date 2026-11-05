import { describe, expect, it } from 'vitest'
import { categories, categoryById, listingTotals, productCategories } from '@/data/categories'
import { cities, cityListingCounts } from '@/data/cities'
import { latestListingIds, listingsByIds, listings, vipListingIds } from '@/data/listings'
import { categoryAdminFields } from '@/data/admin'
import { PLANT_CATEGORY_IDS, subcategoriesByCategory as postAdSubcategories } from '@/data/postAd'
import { subcategoriesByCategory } from '@/features/search/taxonomy'

describe('Variant 2 category data', () => {
  it('lists the ten home categories in the mockup order', () => {
    expect(categories.map((c) => [c.id, c.name, c.listingCount])).toEqual([
      ['agaclar', 'Ağaclar', 1240],
      ['kollar', 'Kollar', 860],
      ['guller', 'Güllər və çiçəklər', 530],
      ['otaq-bitkileri', 'Otaq bitkiləri', 410],
      ['tingler-fidanlar', 'Fidan və toxum', 290],
      ['cim-toxumlar', 'Rulon çəmən', 75],
      ['torpaq-gubreler', 'Gübrə və torpaq', 180],
      ['bag-avadanliqlari', 'Bağ alətləri', 220],
      ['suvarma-sistemleri', 'Suvarma', 140],
      ['landsaft-xidmetleri', 'Bağ xidmətləri', 95],
    ])
    expect(new Set(categories.map((c) => c.icon)).size).toBe(categories.length)
    expect(categoryById('kollar')?.icon).toBe('shrub')
  })

  it('derives the search tab counts from the categories', () => {
    expect(listingTotals).toEqual({ all: 4040, products: 3945, services: 95 })
  })

  it('keeps every listing in an existing category', () => {
    for (const l of listings) expect(categoryById(l.categoryId), l.id).toBeDefined()
    expect(categoryById('dekorativ-bitkiler')).toBeUndefined()
    expect(categoryById('dibcekler-dekorasiya')).toBeUndefined()
  })

  it('keeps the sub-category, post-ad and admin maps on the same ids', () => {
    const productIds = productCategories.map((c) => c.id).sort()
    expect(Object.keys(subcategoriesByCategory).sort()).toEqual(productIds)
    expect(postAdSubcategories).toEqual(subcategoriesByCategory)
    expect(Object.keys(categoryAdminFields).sort()).toEqual(categories.map((c) => c.id).sort())
    for (const id of PLANT_CATEGORY_IDS) expect(categoryById(id)?.kind, id).toBe('product')
  })

  it('gives every city a count and adds them up to "Bütün şəhərlər"', () => {
    expect(Object.keys(cityListingCounts).sort()).toEqual(cities.map((c) => c.id).sort())
    expect(Object.values(cityListingCounts).reduce((a, b) => a + b, 0)).toBe(listingTotals.all)
  })

  it('shows 4 active vitrin listings and 8 other active latest listings on the home page', () => {
    const vip = listingsByIds(vipListingIds)
    const latest = listingsByIds(latestListingIds)
    expect(vip).toHaveLength(4)
    expect(vip.every((l) => l.vip && l.status === 'active')).toBe(true)
    expect(latest).toHaveLength(8)
    expect(latest.every((l) => l.status === 'active')).toBe(true)
    expect(latestListingIds.filter((id) => vipListingIds.includes(id))).toEqual([])
  })
})
