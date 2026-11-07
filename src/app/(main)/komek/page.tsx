import type { Metadata } from 'next'
import { faq } from '@/data/helpPages'
import { pageMetadata } from '@/seo/metadata'
import { FaqItem, HelpShell } from '@/views/HelpPage'

export const metadata: Metadata = pageMetadata({
  title: 'Kömək',
  description: 'Elan yerləşdirmək, hesab, ödəniş və alış haqqında tez-tez verilən suallar.',
  canonical: '/komek',
})

const ids: Record<string, string> = { 'Elan yerləşdirmək': 'elan', Hesab: 'hesab', 'Alıcılar üçün': 'alicilar' }
const idFor = (group: string) => ids[group] ?? 'diger'

/** /komek — frequently asked questions, grouped. */
export default function Page() {
  return (
    <HelpShell title="Kömək" lead="Tez-tez verilən suallar. Cavab tapmadınızsa, bizə yazın." toc={faq.map((g) => ({ id: idFor(g.group), title: g.group }))}>
      {faq.map((g) => (
        <section key={g.group} id={idFor(g.group)} aria-labelledby={`${idFor(g.group)}-t`} className="flex scroll-mt-24 flex-col gap-3">
          <h2 id={`${idFor(g.group)}-t`} className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-xl">
            {g.group}
          </h2>
          <div className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
            {g.items.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </section>
      ))}
    </HelpShell>
  )
}
