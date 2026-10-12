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
  /** "24 elan · yalnız hazırda satışda olan təkliflər" */
  total: number
  /** Category tabs after "Hamısı", in Figma order */
  tabs: SellerTabStat[]
  /**
   * The seller's listings in the order the Figma grid shows them under "Ən yenilər"
   * (also reused for "Satıcının digər elanları" on the listing page). Listings not in the list follow, newest first.
   */
  listingOrder: string[]
}

export const sellerStats: SellerStats[] = [
  {
    sellerId: 'abseron-tingcilik',
    total: 24,
    tabs: [
      { categoryId: 'agaclar', label: 'Ağaclar', count: 14 },
      { categoryId: 'tingler-fidanlar', label: 'Tinglər', count: 6 },
      { categoryId: 'torpaq-gubreler', label: 'Torpaq və gübrələr', count: 4 },
    ],
    listingOrder: ['zeytun-agaci', 'tuya-smaragd', 'defne-agaci', 'torpaq-qarisigi', 'nar-fidani', 'uzvi-kompost'],
  },
]

export function sellerStatsFor(sellerId: string | undefined): SellerStats | undefined {
  return sellerId ? sellerStats.find((s) => s.sellerId === sellerId) : undefined
}
