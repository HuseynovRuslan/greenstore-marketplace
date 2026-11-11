import { describe, expect, it } from 'vitest'
import { categories, categoryById, productCategories, retiredCategoryIds, subcategoryById, subcategoryIdOf } from '@/data/categories'
import { cities } from '@/data/cities'
import { demoListingIds, demoListings } from '@/data/demoListings'
import { latestListingIds, listingById, listingsByIds, listings, publicListings, vipListingIds } from '@/data/listings'
import { loadHeroCounts } from '@/features/home/heroCounts'
import { PLANT_CATEGORY_IDS } from '@/data/postAd'
import { mockRepository } from '@/services/mockRepository'

describe('November 2026 category data', () => {
  it('lists the five plant categories, then the services umbrella', () => {
    expect(categories.map((c) => [c.id, c.name, c.icon, c.kind])).toEqual([
      ['agaclar', 'Ağaclar', 'trees', 'product'],
      ['kollar', 'Kollar', 'shrub', 'product'],
      ['guller', 'Güllər', 'flower', 'product'],
      ['sarmasiqlar', 'Sarmaşıqlar', 'grape', 'product'],
      ['yer-ortucu-bitkiler', 'Yer örtücü bitkilər', 'clover', 'product'],
      ['landsaft-xidmetleri', 'Bağ xidmətləri', 'fence', 'service'],
    ])
    expect(new Set(categories.map((c) => c.icon)).size).toBe(categories.length)
    expect(PLANT_CATEGORY_IDS).toEqual(productCategories.map((c) => c.id))
  })

  it('has the sub-categories of the spreadsheet, with ids unique across categories', () => {
    expect(Object.fromEntries(productCategories.map((c) => [c.id, c.subcategories.map((s) => s.name)]))).toEqual({
      agaclar: ['Meyvə ağacları', 'Enliyarpaqlı yarpaqtökən ağaclar', 'Enliyarpaqlı həmişəyaşıl ağaclar', 'İynəyarpaqlı ağaclar'],
      kollar: ['Yarpaqtökən kollar', 'Həmişəyaşıl kollar'],
      guller: ['Mövsümi güllər', 'Çoxillik güllər'],
      sarmasiqlar: ['Həmişəyaşıl sarmaşıqlar', 'Çiçəkli sarmaşıqlar', 'Yarpaqtökən sarmaşıqlar'],
      'yer-ortucu-bitkiler': ['Həmişəyaşıl', 'Çiçəkli', 'İynəyarpaqlı', 'Sukkulentlər', 'Ot tipli', 'Sürünən yarpaqlı'],
    })
    const ids = productCategories.flatMap((c) => c.subcategories.map((s) => s.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of productCategories) {
      for (const s of c.subcategories) {
        expect(s.id, s.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
        expect(s.id.startsWith(`${c.id}-`), s.id).toBe(true)
        expect(subcategoryById(s.id)?.categoryId).toBe(c.id)
      }
    }
    expect(subcategoryById('kollar-hemiseyasil')?.name).toBe('Həmişəyaşıl kollar')
  })

  it('makes «Kök sistemi» a filter and a required field for Ağaclar and Kollar only', () => {
    const rule = (id: string) => categoryById(id)?.attributes?.rootSystem
    expect(productCategories.filter((c) => rule(c.id)?.filter).map((c) => c.id)).toEqual(['agaclar', 'kollar'])
    expect(productCategories.filter((c) => rule(c.id)?.required).map((c) => c.id)).toEqual(['agaclar', 'kollar'])
  })

  it('keeps every listing in an existing category and sub-category', () => {
    for (const l of listings) {
      expect(categoryById(l.categoryId), l.id).toBeDefined()
      expect(subcategoryIdOf(l.categoryId, l.subcategory), `${l.id}: ${l.subcategory}`).toBeDefined()
    }
    for (const id of retiredCategoryIds) expect(categoryById(id), id).toBeUndefined()
    for (const id of ['monstera-deliciosa', 'terrakota-dibcek', 'torpaq-qarisigi', 'uzvi-kompost']) expect(listingById(id), id).toBeUndefined()
  })

  it('gives every sub-category at least two public listings', () => {
    for (const c of productCategories) {
      for (const s of c.subcategories) {
        const n = publicListings.filter((l) => l.categoryId === c.id && l.subcategory === s.name).length
        expect(n, s.id).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('marks the demo listings with a placeholder photo and a root system on trees and shrubs', () => {
    expect(demoListings).toHaveLength(demoListingIds.length)
    for (const l of demoListings) {
      expect(l.cover, l.id).toBe(`/images/listings/placeholder-${l.categoryId}.webp`)
      if (l.categoryId === 'agaclar' || l.categoryId === 'kollar') expect(l.plant?.rootSystem, l.id).toBeDefined()
    }
    expect(new Set(listings.map((l) => l.slug)).size).toBe(listings.length)
    expect(new Set(listings.map((l) => l.id)).size).toBe(listings.length)
  })

  it('counts the categories, tabs and cities from the listings (no typed-in totals)', async () => {
    const counts = await loadHeroCounts(mockRepository)
    expect(counts.categories.map((c) => c.id)).toEqual(productCategories.map((c) => c.id))
    for (const c of counts.categories) expect(c.listingCount, c.id).toBe(publicListings.filter((l) => l.categoryId === c.id).length)
    expect(counts.tabs.products).toBe(publicListings.length)
    expect(counts.tabs.all).toBe(counts.tabs.products + counts.tabs.services)
    expect(Object.keys(counts.cities).sort()).toEqual(cities.map((c) => c.id).sort())
    expect(Object.values(counts.cities).reduce((a, b) => a + b, 0)).toBe(counts.tabs.products)
  })

  it('shows 4 active promoted listings and 8 other active latest listings on the home page', () => {
    const vip = listingsByIds(vipListingIds)
    const latest = listingsByIds(latestListingIds)
    expect(vip).toHaveLength(4)
    expect(vip.every((l) => l.vip && l.status === 'active')).toBe(true)
    expect(latest).toHaveLength(8)
    expect(latest.every((l) => l.status === 'active')).toBe(true)
    expect(latestListingIds.filter((id) => vipListingIds.includes(id))).toEqual([])
  })
})
