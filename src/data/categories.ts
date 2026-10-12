import type { Category } from '@/types'

/** Home page "Kateqoriyalar" grid (order, icons and counts exactly as in Figma "Ana səhifə · 1440"). */
export const categories: Category[] = [
  { id: 'agaclar', slug: 'agaclar', name: 'Ağaclar', icon: 'trees', listingCount: 428, kind: 'product', description: 'Dekorativ ağaclar, meyvə ağacları, iynəyarpaqlılar' },
  { id: 'dekorativ-bitkiler', slug: 'dekorativ-bitkiler', name: 'Dekorativ bitkilər', icon: 'flower-2', listingCount: 312, kind: 'product' },
  { id: 'guller', slug: 'guller', name: 'Güllər', icon: 'flower', listingCount: 246, kind: 'product' },
  { id: 'tingler-fidanlar', slug: 'tingler-fidanlar', name: 'Tinglər və fidanlar', icon: 'sprout', listingCount: 389, kind: 'product' },
  { id: 'cim-toxumlar', slug: 'cim-toxumlar', name: 'Çim və toxumlar', icon: 'wheat', listingCount: 154, kind: 'product' },
  { id: 'torpaq-gubreler', slug: 'torpaq-gubreler', name: 'Torpaq və gübrələr', icon: 'shovel', listingCount: 183, kind: 'product' },
  { id: 'dibcekler-dekorasiya', slug: 'dibcekler-dekorasiya', name: 'Dibçəklər və dekorasiya', icon: 'amphora', listingCount: 221, kind: 'product' },
  { id: 'suvarma-sistemleri', slug: 'suvarma-sistemleri', name: 'Suvarma sistemləri', icon: 'droplets', listingCount: 127, kind: 'product' },
  { id: 'bag-avadanliqlari', slug: 'bag-avadanliqlari', name: 'Bağ avadanlıqları', icon: 'scissors', listingCount: 168, kind: 'product' },
  { id: 'landsaft-xidmetleri', slug: 'landsaft-xidmetleri', name: 'Landşaft və bağçılıq xidmətləri', icon: 'fence', listingCount: 252, kind: 'service' },
]

export const productCategories = categories.filter((c) => c.kind === 'product')

const byId = new Map(categories.map((c) => [c.id, c]))

export function categoryById(id: string): Category | undefined {
  return byId.get(id)
}
