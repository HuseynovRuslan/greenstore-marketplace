import { Fragment } from 'react'
import Link from 'next/link'

/** "Ana səhifə / Məhsullar / Ağaclar / Zeytun ağacı" — 12 px / 1.5, muted; the last item is the current page. */
export function Breadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Naviqasiya zənciri" className="w-full">
      <ol className="flex flex-wrap items-center text-xs leading-[1.5] text-muted">
        {items.map((item, i) => (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && (
              <li aria-hidden className="whitespace-pre">
                {' / '}
              </li>
            )}
            <li className="min-w-0">
              {item.to ? (
                <Link href={item.to} className="hover:text-forest">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
