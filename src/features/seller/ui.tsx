import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/format'

/*
 * Mint "Məlumat bildirişi" (#eaf0e9): p 18, radius 8, 14 px semibold title + 13 px body, leading 1.6.
 * Same anatomy as the shared `Notice`, which only has the success / warning / danger tones.
 */
export function InfoNotice({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full rounded-lg bg-mint p-[18px] text-ink', className)}>
      <p className="text-sm leading-[1.6] font-semibold">{title}</p>
      {children && <div className="text-[13px] leading-[1.6]">{children}</div>}
    </div>
  )
}

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
                <Link to={item.to} className="hover:text-forest">
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
