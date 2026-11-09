import type { Metadata } from 'next'
import { InfoNotice } from '@/components/ui/Notice'
import { pageMetadata } from '@/seo/metadata'
import { HelpShell } from '@/views/HelpPage'

// Placeholder until the articles exist: kept out of search results (noindex), links still followed.
export const metadata: Metadata = pageMetadata({
  title: 'Bitkiyə qulluq məsləhətləri',
  description: 'Ağac, gül və otaq bitkilərinə qulluq: suvarma, gübrələmə və mövsüm işləri haqqında məsləhətlər.',
  canonical: '/bitkiye-qulluq',
  index: false,
})

/** /bitkiye-qulluq — placeholder (footer «Şirkət»). */
export default function Page() {
  return (
    <HelpShell
      title="Bitkiyə qulluq məsləhətləri"
      lead="Ağac, gül və otaq bitkilərinə necə qulluq etməli: suvarma, gübrələmə, budama və mövsüm işləri."
    >
      <InfoNotice title="Bu səhifə hazırlanır">İlk məqalələr tezliklə burada olacaq.</InfoNotice>
    </HelpShell>
  )
}
