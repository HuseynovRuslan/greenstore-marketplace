import type { Metadata } from 'next'
import { InfoNotice } from '@/components/ui/Notice'
import { pageMetadata } from '@/seo/metadata'
import { HelpShell } from '@/views/HelpPage'

// Placeholder until the company text exists: kept out of search results (noindex), links still followed.
export const metadata: Metadata = pageMetadata({
  title: 'Haqqımızda',
  description: 'GreenStore — Azərbaycanda bitki, bağ məhsulları və bağ xidmətləri üçün elan platforması.',
  canonical: '/haqqimizda',
  index: false,
})

/** /haqqimizda — placeholder (footer «Şirkət»). */
export default function Page() {
  return (
    <HelpShell
      title="Haqqımızda"
      lead="GreenStore Azərbaycanda bitki, bağ məhsulları və bağ xidmətləri üçün elan platformasıdır: alıcı satıcı ilə birbaşa əlaqə saxlayır."
    >
      <InfoNotice title="Bu səhifə hazırlanır">Komanda və platformanın hekayəsi tezliklə burada olacaq.</InfoNotice>
    </HelpShell>
  )
}
