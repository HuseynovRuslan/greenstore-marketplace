import Link from 'next/link'
import { legalLinks } from './footerLinks'

/* Inner pages keep the one-row compact footer: support pages, then the legal links of the full footer. */
const support = [
  { label: 'Kömək', href: '/komek' },
  { label: 'Elan qaydaları', href: '/qaydalar' },
  { label: 'Təhlükəsiz alış', href: '/tehlukesiz-alis' },
  { label: 'Reklam paketləri', href: '/reklam' },
  { label: 'Bizimlə əlaqə', href: '/elaqe' },
]

/**
 * Inner pages: the support and legal links in one row (the full footer, SiteFooter, lives on the home page). Its own
 * module, so inner pages never load the full footer's client island. Focus outline mint: olive is 2.8:1 on forest.
 */
export function CompactFooter() {
  return (
    <footer className="w-full bg-forest text-footer-text">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-7 xl:px-16">
        <nav aria-label="Dəstək və şərtlər">
          <ul className="flex flex-wrap gap-x-5 text-[13px]">
            {[...support, ...legalLinks].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-11 items-center rounded-sm hover:text-white focus-visible:outline-mint">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs">© 2026 GreenStore</p>
      </div>
    </footer>
  )
}
