import type { PromotionPackage, PromotionPackageId } from '@/types'

/*
 * Paid promotion packages (mock prices, AZN). Names follow the management rule: «Önə çıxar» and «İrəli çək», never
 * "VIP". `?vip=1` and `Listing.vip` stay as internal names for «Önə çıxan». Real prices come from the API
 * (MarketplaceRepository.listPromotionPackages); checkout is mocked (docs/handoff/contract-additions.md).
 */
export const promotionPackages: PromotionPackage[] = [
  {
    id: 'ireli-cek',
    name: 'İrəli çək',
    summary: 'Elan siyahıda yenidən ən yuxarı qalxır, sanki indi yerləşdirilib.',
    benefits: ['«Ən yenilər» siyahısında yenidən birinci yerdə', 'Tarix yenilənir, elan təzə görünür', 'Gündə bir dəfə və ya bir neçə gün ardıcıl'],
    options: [
      { id: 'ireli-cek-1', label: '1 dəfə', price: 1, bumps: 1 },
      { id: 'ireli-cek-5', label: '5 gün, hər gün', price: 4, bumps: 5, days: 5 },
      { id: 'ireli-cek-10', label: '10 gün, hər gün', price: 7, bumps: 10, days: 10 },
    ],
  },
  {
    id: 'one-cixar',
    name: 'Önə çıxar',
    summary: 'Elan ana səhifədə və axtarışın başında «Önə çıxan» nişanı ilə göstərilir.',
    benefits: ['Ana səhifədə «Önə çıxan elanlar» bölməsində', 'Axtarış nəticələrinin başında', '«Önə çıxan» nişanı ilə seçilir'],
    options: [
      { id: 'one-cixar-3', label: '3 gün', price: 5, days: 3 },
      { id: 'one-cixar-7', label: '7 gün', price: 9, days: 7 },
      { id: 'one-cixar-15', label: '15 gün', price: 16, days: 15 },
    ],
  },
  {
    id: 'paket',
    name: 'Önə çıxar + İrəli çək',
    summary: 'Hər ikisi bir arada: həm nişan və ana səhifə, həm də hər gün siyahının başı.',
    benefits: ['«Önə çıxar»ın bütün üstünlükləri', 'Hər gün avtomatik «İrəli çək»', 'Ayrı-ayrı almaqdan sərfəli'],
    options: [
      { id: 'paket-7', label: '7 gün', price: 13, days: 7, bumps: 7 },
      { id: 'paket-15', label: '15 gün', price: 22, days: 15, bumps: 15 },
    ],
  },
]

export function promotionPackage(id: PromotionPackageId): PromotionPackage | undefined {
  return promotionPackages.find((p) => p.id === id)
}

export function promotionOption(optionId: string) {
  for (const pkg of promotionPackages) {
    const option = pkg.options.find((o) => o.id === optionId)
    if (option) return { pkg, option }
  }
  return undefined
}
