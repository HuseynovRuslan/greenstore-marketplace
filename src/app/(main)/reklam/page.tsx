import type { Metadata } from 'next'
import { Rocket } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { getRepository, isNotImplemented } from '@/services/repository'
import { pageMetadata } from '@/seo/metadata'
import PromotionPage from '@/views/PromotionPage'

export const metadata: Metadata = pageMetadata({
  title: 'Reklam paketləri: irəli çək və önə çıxar',
  description: '«İrəli çək», «Önə çıxar» və paket: elanınızı ana səhifədə və axtarışın başında göstərin. Qiymətlər və şərtlər.',
  canonical: '/reklam',
})

/**
 * /reklam — promotion packages. Prices come from the repository; the purchase is a client island (session). With the
 * API, packages and payment come in phase 5 (backend/ARCHITECTURE.md §17): until then the page says so.
 */
export default async function Page() {
  const packages = await getRepository()
    .listPromotionPackages()
    .catch((error: unknown) => {
      if (isNotImplemented(error)) return undefined
      throw error
    })
  if (!packages) {
    return (
      <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
        <EmptyState
          icon={<Rocket aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
          title="Reklam paketləri tezliklə"
          description="Elanı önə çıxarmaq və irəli çəkmək ödəniş qoşulandan sonra mümkün olacaq."
          action={
            <ButtonLink href="/elanlar" fullWidth>
              Elanlara bax
            </ButtonLink>
          }
        />
      </div>
    )
  }
  return <PromotionPage packages={packages} />
}
