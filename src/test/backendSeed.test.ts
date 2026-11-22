import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listings } from '@/data/listings'
import { listingGallery } from '@/features/listing/detail'
import { contractSources, extractFrontendContract } from '../../backend/contracts/frontendTypes'
import { buildSeedFiles, formatJson } from '../../backend/seed/buildSeed'

/**
 * The API seeds its database from backend/seed/**.json and checks its responses against backend/contracts/**.json.
 * Those files are generated from src/ by `node backend/seed/export.mjs`; when src/data or src/types change, this test
 * fails until the export is run again (and the API's tests then show what the change means for the backend).
 */
const root = join(__dirname, '..', '..')
const backend = join(root, 'backend')
const committed = (path: string) => readFileSync(join(backend, path), 'utf8')
const rerun = 'out of date: run `node backend/seed/export.mjs`'

describe('backend seed and contract files', () => {
  const files = buildSeedFiles()

  it.each(Object.keys(files))('backend/%s matches src/data', (path) => {
    expect(committed(path), `backend/${path} is ${rerun}`).toBe(formatJson(files[path]))
  })

  it('backend/contracts/frontend-types.json matches src/types', () => {
    const contract = extractFrontendContract(Object.fromEntries(contractSources.map((path) => [path, readFileSync(join(root, path), 'utf8')])))
    expect(committed('contracts/frontend-types.json'), `backend/contracts/frontend-types.json is ${rerun}`).toBe(formatJson(contract))
    expect(contract.unions.RootSystem).toEqual(['container', 'rootball', 'bare-root'])
    expect(contract.interfaces.Listing.vip).toEqual({ optional: false, type: 'boolean' })
  })

  it('gives every demo listing a unique number and real references', () => {
    const listings = (files['seed/demo/listings.json'] as { items: Array<{ number: number; owner: string; seller?: string }> }).items
    const services = (files['seed/demo/services.json'] as { items: Array<{ number: number; owner: string }> }).items
    const users = new Set((files['seed/demo/users.json'] as { items: Array<{ key: string }> }).items.map((u) => u.key))
    const sellers = new Set((files['seed/demo/sellers.json'] as { items: Array<{ key: string }> }).items.map((s) => s.key))
    const numbers = [...listings, ...services].map((l) => l.number)
    expect(new Set(numbers).size).toBe(numbers.length)
    for (const l of [...listings, ...services]) expect(users.has(l.owner)).toBe(true)
    for (const l of listings) if (l.seller) expect(sellers.has(l.seller)).toBe(true)
  })

  it('shows every demo listing’s detail gallery as the mock does, although the API puts the cover first', () => {
    // The API answers `cover` = the first photo and `images` = every photo (DATABASE.md §3.5); listingGallery then
    // keeps Figma's dedicated `-gallery-N` photos, or puts the cover first, so the page shows the same photos.
    const rows = new Map((files['seed/demo/listings.json'] as { items: Array<{ key: string; photos: string[] }> }).items.map((r) => [r.key, r.photos]))
    for (const listing of listings) {
      const photos = rows.get(listing.id)
      expect(photos, listing.id).toBeDefined()
      expect(listingGallery({ ...listing, cover: photos![0], images: photos! }), listing.id).toEqual(listingGallery(listing))
    }
  })

  it('writes ru and en names for every category, sub-category and city', () => {
    type Named = { name: { az: string; ru?: string; en?: string }; subcategories?: Named[] }
    const categories = (files['seed/reference/categories.json'] as { items: Named[] }).items
    const cities = (files['seed/reference/cities.json'] as { items: Named[] }).items
    const all = [...categories, ...categories.flatMap((c) => c.subcategories ?? []), ...cities]
    for (const item of all) {
      expect(item.name.ru, item.name.az).toBeTruthy()
      expect(item.name.en, item.name.az).toBeTruthy()
    }
  })
})
