import type { Category } from '@/types'

/*
 * Category structure: management's preliminary list of November 2026 («hələlik belə olsun»), from
 * docs/data/kateqoriyalar-2026-11.xlsx (sheets «Kateqoriyalar», «Alt kateqoriyalar», «Xüsusiyyətlər»). Products are
 * plants only; «Bağ xidmətləri» is the services umbrella (/xidmetler).
 *
 * This file is the one place to change the list. The home categories row, the hero search, the /elanlar filters,
 * «Elan yerləşdir», admin, the footer, the sitemap and the old-URL redirects (next.config.ts) all read it.
 *
 * - `id` is also the URL slug (/kateqoriyalar/{id}, ?kateqoriya={id}).
 * - Sub-category ids are unique across categories (?alt={id}): the category id, then the name without the category
 *   word, in ASCII (`kollar-hemiseyasil`). Listings keep the sub-category *name* (`Listing.subcategory`, unchanged
 *   contract); `subcategoryIdOf` maps a name back to its id.
 * - Counts are not stored here: client components import this file, so it must not pull in the listing data. They
 *   are counted from the sample listings on the server (categoryCounts.ts).
 *
 * Only `import type` above: next.config.ts reads `retiredCategoryIds` from this file.
 * Backend handoff: docs/handoff/categories.md.
 */

export interface Subcategory {
  /** Unique across all categories: `<category id>-<name without the category word>` */
  id: string
  name: string
}

/** The «Elan yerləşdir» attribute set a category uses (features/posting/attributes.ts). */
export type CategoryForm = 'plant' | 'pack' | 'goods' | 'grass' | 'service'

/** A row of the «Xüsusiyyətlər» sheet for one category: a filter on /elanlar, a required field when posting. */
export interface AttributeRule {
  filter?: boolean
  required?: boolean
}

export interface CategoryDef extends Omit<Category, 'listingCount'> {
  subcategories: Subcategory[]
  form: CategoryForm
  /** Plants: «Elan yerləşdir» asks «Yarpaq» (həmişəyaşıl / yarpaqtökən). */
  foliage?: boolean
  /** «Xüsusiyyətlər» sheet. «Kök sistemi»: Dibçəkdə, Torpaq kürəsi ilə, Açıq kök. */
  attributes?: { rootSystem?: AttributeRule }
}

/** «Ağaclar, Kollar · Kök sistemi · filtr: Bəli · məcburi: Bəli» */
const rootSystemFilterRequired: AttributeRule = { filter: true, required: true }

export const categories: CategoryDef[] = [
  {
    id: 'agaclar',
    slug: 'agaclar',
    name: 'Ağaclar',
    icon: 'trees',
    kind: 'product',
    description: 'Dekorativ və meyvə ağacları, iynəyarpaqlılar',
    form: 'plant',
    foliage: true,
    attributes: { rootSystem: rootSystemFilterRequired },
    subcategories: [
      { id: 'agaclar-meyve', name: 'Meyvə ağacları' },
      { id: 'agaclar-enliyarpaqli-yarpaqtoken', name: 'Enliyarpaqlı yarpaqtökən ağaclar' },
      { id: 'agaclar-enliyarpaqli-hemiseyasil', name: 'Enliyarpaqlı həmişəyaşıl ağaclar' },
      { id: 'agaclar-iyneyarpaqli', name: 'İynəyarpaqlı ağaclar' },
    ],
  },
  {
    id: 'kollar',
    slug: 'kollar',
    name: 'Kollar',
    icon: 'shrub',
    kind: 'product',
    form: 'plant',
    foliage: true,
    attributes: { rootSystem: rootSystemFilterRequired },
    subcategories: [
      { id: 'kollar-yarpaqtoken', name: 'Yarpaqtökən kollar' },
      { id: 'kollar-hemiseyasil', name: 'Həmişəyaşıl kollar' },
    ],
  },
  {
    id: 'guller',
    slug: 'guller',
    name: 'Güllər',
    icon: 'flower',
    kind: 'product',
    form: 'plant',
    subcategories: [
      { id: 'guller-movsumi', name: 'Mövsümi güllər' },
      { id: 'guller-coxillik', name: 'Çoxillik güllər' },
    ],
  },
  {
    id: 'sarmasiqlar',
    slug: 'sarmasiqlar',
    name: 'Sarmaşıqlar',
    icon: 'grape',
    kind: 'product',
    form: 'plant',
    foliage: true,
    subcategories: [
      { id: 'sarmasiqlar-hemiseyasil', name: 'Həmişəyaşıl sarmaşıqlar' },
      { id: 'sarmasiqlar-cicekli', name: 'Çiçəkli sarmaşıqlar' },
      { id: 'sarmasiqlar-yarpaqtoken', name: 'Yarpaqtökən sarmaşıqlar' },
    ],
  },
  {
    id: 'yer-ortucu-bitkiler',
    slug: 'yer-ortucu-bitkiler',
    name: 'Yer örtücü bitkilər',
    icon: 'clover',
    kind: 'product',
    form: 'plant',
    foliage: true,
    subcategories: [
      { id: 'yer-ortucu-bitkiler-hemiseyasil', name: 'Həmişəyaşıl' },
      { id: 'yer-ortucu-bitkiler-cicekli', name: 'Çiçəkli' },
      { id: 'yer-ortucu-bitkiler-iyneyarpaqli', name: 'İynəyarpaqlı' },
      { id: 'yer-ortucu-bitkiler-sukkulentler', name: 'Sukkulentlər' },
      { id: 'yer-ortucu-bitkiler-ot-tipli', name: 'Ot tipli' },
      { id: 'yer-ortucu-bitkiler-surunen-yarpaqli', name: 'Sürünən yarpaqlı' },
    ],
  },
  // Services stay as they were: the umbrella of /xidmetler, whose own service types live in data/services.ts.
  { id: 'landsaft-xidmetleri', slug: 'landsaft-xidmetleri', name: 'Bağ xidmətləri', icon: 'fence', kind: 'service', form: 'service', subcategories: [] },
]

/**
 * Product categories taken off the site in November 2026. Their old URLs (/kateqoriyalar/{id}, also with a city)
 * redirect to /elanlar (next.config.ts), temporarily: the list is preliminary and a category may come back.
 */
export const retiredCategoryIds = ['otaq-bitkileri', 'tingler-fidanlar', 'cim-toxumlar', 'torpaq-gubreler', 'bag-avadanliqlari', 'suvarma-sistemleri']

export const productCategories = categories.filter((c) => c.kind === 'product')

const byId = new Map(categories.map((c) => [c.id, c]))

export function categoryById(id: string): CategoryDef | undefined {
  return byId.get(id)
}

/** A category's sub-categories (none for an unknown id). */
export function subcategoriesOf(categoryId: string): Subcategory[] {
  return byId.get(categoryId)?.subcategories ?? []
}

const subById = new Map(productCategories.flatMap((c) => c.subcategories.map((s) => [s.id, { ...s, categoryId: c.id }] as const)))

/** A sub-category by its id, with the category it belongs to. */
export function subcategoryById(id: string): (Subcategory & { categoryId: string }) | undefined {
  return subById.get(id)
}

/** The id of a sub-category name within a category ("Meyvə ağacları" in agaclar → agaclar-meyve). */
export function subcategoryIdOf(categoryId: string, name: string | undefined): string | undefined {
  if (!name) return undefined
  return subcategoriesOf(categoryId).find((s) => s.name === name)?.id
}

/** Is «Kök sistemi» a filter on /elanlar for this category? */
export const hasRootSystemFilter = (categoryId: string) => Boolean(byId.get(categoryId)?.attributes?.rootSystem?.filter)

/** Must «Elan yerləşdir» ask for «Kök sistemi» here? */
export const requiresRootSystem = (categoryId: string) => Boolean(byId.get(categoryId)?.attributes?.rootSystem?.required)
