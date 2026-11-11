import type { Metadata } from 'next'
import Link from 'next/link'
import { footerGroups, legalLinks, type FooterLink } from '@/components/layout/footerLinks'
import { pageMetadata } from '@/seo/metadata'
import { HelpShell } from '@/views/HelpPage'

export const metadata: Metadata = pageMetadata({
  title: 'Sayt xəritəsi',
  description: 'GreenStore-un bütün bölmələri bir səhifədə: kateqoriyalar, şəhərlər, satıcılar üçün və kömək səhifələri.',
  canonical: '/sayt-xeritesi',
})

const main: FooterLink[] = [
  { label: 'Ana səhifə', href: '/' },
  { label: 'Məhsullar', href: '/elanlar' },
  { label: 'Xidmətlər', href: '/xidmetler' },
  { label: 'Satıcılar', href: '/saticilar' },
  { label: 'Reklam paketləri', href: '/reklam' },
]

/** /sayt-xeritesi — every section on one page, from the same link data as the footer (footerLinks.ts). */
export default function Page() {
  const sections = [
    { id: 'esas', title: 'Əsas bölmələr', links: main },
    ...footerGroups().map((g) => ({ id: g.id, title: g.title, links: g.more ? [...g.links, g.more] : g.links })),
    { id: 'huquqi', title: 'Hüquqi məlumat', links: legalLinks.filter((l) => l.href !== '/sayt-xeritesi') },
  ]
  return (
    <HelpShell title="Sayt xəritəsi" lead="GreenStore-un bütün bölmələri bir yerdə." toc={sections.map((s) => ({ id: s.id, title: s.title }))}>
      {sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="flex scroll-mt-24 flex-col gap-2">
          <h2 id={`${s.id}-t`} className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-xl">
            {s.title}
          </h2>
          <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.links.map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} className="inline-flex min-h-11 items-center text-[15px] text-forest underline-offset-2 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </HelpShell>
  )
}
