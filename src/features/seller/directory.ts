import type { MarketplaceRepository, PageResult } from '@/services/repository'
import type { BusinessKind, Seller } from '@/types'

/** The kind tabs of /saticilar ('' = «Hamısı»), in their order. */
export const directoryKinds: Array<BusinessKind | ''> = ['', 'nursery', 'garden-centre', 'landscaping']

export interface SellerDirectory {
  result: PageResult<Seller>
  /** Businesses in the chosen city per kind tab */
  counts: Record<BusinessKind | '', number>
}

/** One page of /saticilar and the count of every kind tab in the chosen city (one cached read each). */
export async function loadSellerDirectory(repo: MarketplaceRepository, { kind, city, page }: { kind: BusinessKind | ''; city: string; page: number }): Promise<SellerDirectory> {
  const cityId = city || undefined
  const [result, ...totals] = await Promise.all([
    repo.listSellers({ businessKind: kind || undefined, cityId, page }),
    ...directoryKinds.map((k) => repo.listSellers({ businessKind: k || undefined, cityId, page: 1, pageSize: 1 })),
  ])
  const counts = Object.fromEntries(directoryKinds.map((k, i) => [k, totals[i].total])) as Record<BusinessKind | '', number>
  return { result, counts }
}
