import type { Metadata } from 'next'
import { getRepository } from '@/services/repository'
import { dataSource } from '@/seo/env'
import { pageMetadata } from '@/seo/metadata'
import PromotionPage from '@/views/PromotionPage'

export const metadata: Metadata = pageMetadata({
  title: 'Reklam paketləri: irəli çək və önə çıxar',
  description: '«İrəli çək», «Önə çıxar» və paket: elanınızı ana səhifədə və axtarışın başında göstərin. Qiymətlər və şərtlər.',
  canonical: '/reklam',
})

/**
 * /reklam — promotion packages. Prices come from the repository (DATA_SOURCE=api: `GET /promotion-packages`, cached
 * like the other public reads); the purchase is a client island (session). With the API the order goes to the payment
 * provider's page (backend-contract.md 5.1); the demo pays in the browser.
 */
export default async function Page() {
  const packages = await getRepository().listPromotionPackages()
  return <PromotionPage packages={packages} demo={dataSource() !== 'api'} />
}
