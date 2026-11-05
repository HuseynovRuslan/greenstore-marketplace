import type { Category } from '@/types'

/**
 * Category catalogue in the order of the home page "Variant 2" categories row (docs/design/variant-2).
 * Ids are URL slugs (/kateqoriyalar/{id}); ids that existed before Variant 2 are kept so their URLs stay valid,
 * only names and counts changed. `kollar` and `otaq-bitkileri` replace "Dekorativ bitkilər"; "Dibçəklər və
 * dekorasiya" is folded into `bag-avadanliqlari`. Backend handoff: docs/handoff/categories.md.
 * `listingCount` is the platform-wide mock total shown on the home page (tab counts are sums of these).
 */
export const categories: Category[] = [
  { id: 'agaclar', slug: 'agaclar', name: 'Ağaclar', icon: 'trees', listingCount: 1240, kind: 'product', description: 'Dekorativ ağaclar, meyvə ağacları, iynəyarpaqlılar' },
  { id: 'kollar', slug: 'kollar', name: 'Kollar', icon: 'shrub', listingCount: 860, kind: 'product' },
  { id: 'guller', slug: 'guller', name: 'Güllər və çiçəklər', icon: 'flower', listingCount: 530, kind: 'product' },
  { id: 'otaq-bitkileri', slug: 'otaq-bitkileri', name: 'Otaq bitkiləri', icon: 'amphora', listingCount: 410, kind: 'product' },
  { id: 'tingler-fidanlar', slug: 'tingler-fidanlar', name: 'Fidan və toxum', icon: 'sprout', listingCount: 290, kind: 'product' },
  { id: 'cim-toxumlar', slug: 'cim-toxumlar', name: 'Rulon çəmən', icon: 'wheat', listingCount: 75, kind: 'product' },
  { id: 'torpaq-gubreler', slug: 'torpaq-gubreler', name: 'Gübrə və torpaq', icon: 'shovel', listingCount: 180, kind: 'product' },
  { id: 'bag-avadanliqlari', slug: 'bag-avadanliqlari', name: 'Bağ alətləri', icon: 'scissors', listingCount: 220, kind: 'product' },
  { id: 'suvarma-sistemleri', slug: 'suvarma-sistemleri', name: 'Suvarma', icon: 'droplets', listingCount: 140, kind: 'product' },
  { id: 'landsaft-xidmetleri', slug: 'landsaft-xidmetleri', name: 'Bağ xidmətləri', icon: 'fence', listingCount: 95, kind: 'service' },
]

export const productCategories = categories.filter((c) => c.kind === 'product')

const sumCounts = (list: Category[]) => list.reduce((total, c) => total + c.listingCount, 0)

/** Home search tab counts ("Hamısı" / "Məhsullar" / "Xidmətlər"), derived from the category counts. */
export const listingTotals = {
  all: sumCounts(categories),
  products: sumCounts(productCategories),
  services: sumCounts(categories.filter((c) => c.kind === 'service')),
}

const byId = new Map(categories.map((c) => [c.id, c]))

export function categoryById(id: string): Category | undefined {
  return byId.get(id)
}
