import type { Category, Listing } from '@/types'
import { TITLE_MAX } from '@/data/postAd'
import { emptySearchState, type SearchState } from '@/features/search/searchUrl'

/*
 * Worst-case data for the dev-only page /dev/worst-case (break-ui). Every value is realistic or the limit the code
 * enforces, and each row carries a different failure, as real data does. Shaped exactly like the demo data: the page
 * takes demo listings from the repository and overrides fields, so nothing here reaches production pages.
 */

export type WorstCaseMode = 'demo' | 'worst' | 'empty' | 'one'

export const worstCaseModes: Array<{ value: WorstCaseMode; label: string }> = [
  { value: 'demo', label: 'Demo' },
  { value: 'worst', label: 'Ən pis hal' },
  { value: 'empty', label: 'Boş' },
  { value: 'one', label: 'Bir' },
]

export function parseWorstCaseMode(value: string | string[] | undefined): WorstCaseMode {
  return worstCaseModes.some((m) => m.value === value) ? (value as WorstCaseMode) : 'worst'
}

/** A title at the post-ad limit (TITLE_MAX = 80 characters). */
export const LONGEST_TITLE = 'Zeytun ağacı (Olea europaea), 3,5 metr, 25 yaşlı, torpaq kürəsi ilə, çatdırılma.'.slice(0, TITLE_MAX)

/** A search word someone pastes in (the search fields have no length limit today). */
export const LONG_QUERY = 'zeytun ağacı 3 metr torpaq kürəsi ilə Bakıya çatdırılma'

/** Six cards, six failures: longest title, 7-digit price, broken photo, long details, price 0 + Latin name, short title. */
export function worstCaseListings(demo: Listing[]): Listing[] {
  const [a, b, c, d, e, f] = demo
  return [
    { ...a, id: 'wc-title', title: LONGEST_TITLE, vip: true },
    { ...b, id: 'wc-price', price: 1_250_000 },
    // A photo URL that answers 404 (deliberately outside /images, whose paths src/test/assets.test.ts checks).
    { ...c, id: 'wc-photo', title: 'Qızılgül', cover: '/foto-yoxdur.jpg', coverTablet: undefined, coverMobile: undefined, vip: true },
    { ...d, id: 'wc-details', cityId: 'lenkeran', attributes: ['180–200 sm', '25 yaş', 'torpaq kürəsi ilə', 'qırmızı yarpaq'] },
    { ...e, id: 'wc-zero', price: 0, title: "Chamaecyparis lawsoniana 'Ellwoodii' — 120 sm" },
    { ...f, id: 'wc-short', price: 9_999_999, title: 'Gül' },
  ]
}

/** The category row with 99 999 and 0 listings, a long single word and a name that needs a clamp. */
export function worstCaseCategories(demo: Category[]): Category[] {
  return demo.map((c, i) => {
    if (i === 0) return { ...c, listingCount: 99_999 }
    if (i === 1) return { ...c, listingCount: 0 }
    if (i === 2) return { ...c, name: 'Dekorativ iynəyarpaqlılar' }
    if (i === 3) return { ...c, name: 'Otaq və balkon bitkiləri, dibçəklər' }
    return c
  })
}

/** Filters for the chip row: a pasted search word, every group set, prices at the 7-digit cap. */
export const worstCaseSearch: SearchState = {
  ...emptySearchState,
  q: LONG_QUERY,
  cityIds: ['lenkeran'],
  categoryId: 'agaclar',
  min: '1000000',
  max: '9999999',
  height: '300-',
  age: '5-',
  sellerType: 'biznes',
  delivery: true,
  vip: true,
}

export const demoSearch: SearchState = { ...emptySearchState, q: 'zeytun', categoryId: 'agaclar' }

export const oneSearch: SearchState = { ...emptySearchState, categoryId: 'agaclar' }
