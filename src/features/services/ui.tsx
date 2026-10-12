import { Fragment, type HTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/lib/format'

/** Figma breadcrumb line ("Ana səhifə / Xidmətlər / Landşaft dizaynı"): 12 px / 1.5, #727c72. */
export function Breadcrumbs({ items, className }: { items: Array<{ label: string; to?: string }>; className?: string }) {
  return (
    <nav aria-label="Naviqasiya yolu" className={cn('w-full text-[12px] leading-[1.5] text-muted', className)}>
      <ol className="flex flex-wrap">
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {i > 0 && (
              <li aria-hidden className="whitespace-pre">
                {' / '}
              </li>
            )}
            <li>
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

/** Figma "Bölmə başlığı" used as page title: 30 px / 1.35 (23 px on mobile) + 15 px muted line (block height 62 px in Figma → 1.43, as in SectionHeader). */
export function PageHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="w-full text-ink">
      <h1 className="text-[23px] leading-[1.35] font-normal md:text-[30px]">{title}</h1>
      {subtitle && <p className="text-[15px] leading-[1.43] text-muted">{subtitle}</p>}
    </div>
  )
}

/** Inner-page content column: 15 px spacer under the header + 36 px top padding (24 on 390), 28 px section gap. */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-[39px] pb-6 md:pt-[51px] md:pb-9', className)}>
      {children}
    </div>
  )
}

/**
 * Shared `Panel` with the Figma inside-stroke geometry: 1 px border + 23 px padding = content 24 px from the edge
 * (the shared Panel's p-6 adds the border on top, which makes every panel 2 px taller and 2 px narrower inside).
 */
export function InsetPanel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <Panel className={className} {...rest} />
}
