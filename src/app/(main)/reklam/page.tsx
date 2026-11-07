import type { Metadata } from 'next'
import { getRepository } from '@/services/repository'
import { pageMetadata } from '@/seo/metadata'
import PromotionPage from '@/views/PromotionPage'

export const metadata: Metadata = pageMetadata({
  title: 'Elanı irəli çək və önə çıxar',
  description: '«İrəli çək», «Önə çıxar» və paket: elanınızı ana səhifədə və axtarışın başında göstərin. Qiymətlər və şərtlər.',
  canonical: '/reklam',
})

/** /reklam — promotion packages. Prices come from the repository; the purchase is a client island (session). */
export default async function Page() {
  const packages = await getRepository().listPromotionPackages()
  return <PromotionPage packages={packages} />
}
