import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
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

/** Figma "Bölmə başlığı" used as page title: 30 px / 1.35 (23 px on mobile) + 15 px muted line (block height 62 px in Figma → 1.43, as in SectionHeader). */
export function PageHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="w-full text-ink">
      <h1 className="text-[23px] leading-[1.35] font-normal md:text-[30px]">{title}</h1>
      {subtitle && <p className="text-[15px] leading-[1.43] text-muted">{subtitle}</p>}
    </div>
  )
}

/**
 * Figma "Məlumat bildirişi" in its neutral (#eaf0e9) variant — p 18, radius 8, 14 px semibold title + 13 px body (leading 1.6).
 * The shared `Notice` only has success/warning/danger tones, so the neutral one lives here.
 */
export function InfoNotice({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <aside className={cn('w-full rounded-lg bg-mint p-[18px] text-ink', className)}>
      <p className="text-sm leading-[1.6] font-semibold">{title}</p>
      {children && <p className="text-[13px] leading-[1.6]">{children}</p>}
    </aside>
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
