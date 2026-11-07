import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, LifeBuoy, MessageSquare } from 'lucide-react'
import type { HelpPage as HelpPageData } from '@/data/helpPages'
import { Breadcrumb } from '@/features/seller/ui'
import { formatFullDate } from '@/lib/format'

/** Footer «Dəstək» links, also listed at the end of each help page. */
export const helpLinks = [
  { label: 'Kömək', to: '/komek' },
  { label: 'Elan qaydaları', to: '/qaydalar' },
  { label: 'Təhlükəsiz alış', to: '/tehlukesiz-alis' },
  { label: 'Bizimlə əlaqə', to: '/elaqe' },
]

/** Shell of the support pages: breadcrumb, heading and lead, an «on this page» list from 1024 px, then the content. */
export function HelpShell({ title, lead, toc, children, updated }: { title: string; lead: string; toc?: Array<{ id: string; title: string }>; children: ReactNode; updated?: string }) {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-3 pb-14 md:pt-5">
      <Breadcrumb
        items={[
          { label: 'Ana səhifə', to: '/' },
          { label: title },
        ]}
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] text-forest md:text-[34px]">{title}</h1>
        <p className="max-w-[62ch] text-[15px] leading-[1.6] text-ink-soft md:text-base">{lead}</p>
        {updated && <p className="text-[13px] text-muted">Yeniləndi: {formatFullDate(updated)}</p>}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        {toc && toc.length > 0 ? (
          <nav aria-label="Bu səhifədə" className="max-lg:hidden">
            <div className="sticky top-24 flex flex-col gap-1">
              <p className="mb-1 text-[13px] font-semibold text-muted">Bu səhifədə</p>
              {toc.map((t) => (
                <a key={t.id} href={`#${t.id}`} className="rounded-md px-2 py-1.5 text-sm leading-[1.35] text-ink-soft hover:bg-mint hover:text-forest">
                  {t.title}
                </a>
              ))}
            </div>
          </nav>
        ) : (
          <span className="max-lg:hidden" />
        )}
        <div className="flex min-w-0 flex-col gap-8">
          {children}
          <aside aria-label="Dəstək" className="flex flex-col gap-3 rounded-2xl bg-sand p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-start gap-3">
              <LifeBuoy aria-hidden size={22} strokeWidth={1.8} className="mt-0.5 shrink-0 text-forest" />
              <p className="text-sm leading-[1.5] text-ink">
                <span className="font-semibold">Sualınız qaldı?</span> Dəstək komandası hər gün 09:00–21:00 cavab verir.
              </p>
            </div>
            <Link href="/elaqe" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover">
              <MessageSquare aria-hidden size={17} strokeWidth={1.8} />
              Bizə yazın
            </Link>
          </aside>
          <nav aria-label="Digər kömək səhifələri" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {helpLinks.map((l) => (
              <Link key={l.to} href={l.to} className="inline-flex min-h-11 items-center font-medium text-forest underline-offset-2 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

/** A rules / safety / terms / privacy page from its data. */
export default function HelpPage({ page }: { page: HelpPageData }) {
  return (
    <HelpShell title={page.title} lead={page.lead} updated={page.updated} toc={page.sections.map((s) => ({ id: s.id, title: s.title }))}>
      {page.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="flex scroll-mt-24 flex-col gap-3">
          <h2 id={`${s.id}-t`} className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-xl">
            {s.title}
          </h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="max-w-[68ch] text-[15px] leading-[1.65] text-ink">
              {p}
            </p>
          ))}
          {s.list && (
            <ul className="flex max-w-[68ch] flex-col gap-2 text-[15px] leading-[1.55] text-ink">
              {s.list.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-olive" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </HelpShell>
  )
}

/** One question with its answer (details/summary: keyboard and screen readers know it as a disclosure). */
export function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group px-5">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] leading-[1.4] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown aria-hidden size={18} strokeWidth={2} className="shrink-0 text-muted transition-transform duration-(--dur-base) ease-out group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <p className="max-w-[68ch] pb-4 text-sm leading-[1.6] text-ink-soft">{a}</p>
    </details>
  )
}
