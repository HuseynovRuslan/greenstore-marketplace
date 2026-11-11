/**
 * Seller-stated totals shown on the public seller page (Figma "Abşeron Tingçilik · 1440").
 *
 * The tab counters ("Hamısı · 24", "Ağaclar · 14", …) and "24 elan" are the seller's own totals as written in the
 * design. The demo data only contains a subset of those listings, so the grid below the tabs always shows the
 * listings that really exist in `@/data/listings` while the counters keep the Figma numbers.
 */
export interface SellerTabStat {
  /** URL value of the tab (`?kateqoriya=`); `undefined` = "Hamısı" */
  categoryId?: string
  label: string
  count: number
}

export interface SellerStats {
  sellerId: string
  /** "24 elan · yalnız hazırda satışda olan təkliflər"; without it, counted from the listings */
  total?: number
  /** Category tabs after "Hamısı", in Figma order; without them, one tab per category of the listings */
  tabs?: SellerTabStat[]
  /**
   * The seller's listings in the order the Figma grid shows them under "Ən yenilər"
   * (also reused for "Satıcının digər elanları" on the listing page). Listings not in the list follow, newest first.
   */
  listingOrder: string[]
}

export const sellerStats: SellerStats[] = [
  {
    // Figma also stated "24 elan" with tabs Ağaclar 14 · Fidan və toxum 6 · Gübrə və torpaq 4. Two of those
    // categories left the site in November 2026, so the tabs and totals are now counted from the listings.
    sellerId: 'abseron-tingcilik',
    listingOrder: ['zeytun-agaci', 'tuya-smaragd', 'defne-agaci', 'nar-fidani'],
  },
]

export function sellerStatsFor(sellerId: string | undefined): SellerStats | undefined {
  return sellerId ? sellerStats.find((s) => s.sellerId === sellerId) : undefined
}
