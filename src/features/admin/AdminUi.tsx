'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/format'
import { chipClass } from './lib'

const sections: Array<{ label: string; to?: string; paths: string[] }> = [
  { label: 'Moderasiya', to: '/idareetme/moderasiya', paths: ['/idareetme', '/idareetme/moderasiya'] },
  { label: 'Kateqoriyalar', to: '/idareetme/kateqoriyalar', paths: ['/idareetme/kateqoriyalar'] },
  { label: 'Şikayətlər', to: '/idareetme/sikayetler', paths: ['/idareetme/sikayetler'] },
  /* "İstifadəçilər" has no screen in the design yet — shown as in Figma but not navigable. */
  { label: 'İstifadəçilər', paths: [] },
]

/**
 * The admin sections (Moderasiya · Kateqoriyalar · Şikayətlər · İstifadəçilər) as underlined tabs: the page's top
 * level, set apart from the chips that filter inside a section. «İstifadəçilər» has no screen yet and says so.
 */
export function AdminTabs() {
  const pathname = usePathname()
  const current = pathname.replace(/\/+$/, '') || '/'
  return (
    <nav aria-label="İdarəetmə bölmələri" className="w-full border-b border-line">
      <ul className="-mb-px flex w-full gap-5 overflow-x-auto sm:gap-6">
        {sections.map((s) => {
          const active = s.paths.includes(current)
          const tab = 'inline-flex min-h-11 items-center gap-1.5 border-b-2 text-[15px] leading-[normal] whitespace-nowrap'
          return (
            <li key={s.label} className="shrink-0">
              {s.to ? (
                <Link
                  href={s.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    tab,
                    'transition-colors duration-(--dur-fast) focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:ring-inset',
                    active ? 'border-forest font-semibold text-forest' : 'border-transparent text-ink-soft hover:border-line-strong hover:text-forest',
                  )}
                >
                  {s.label}
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(tab, 'cursor-not-allowed border-transparent text-muted')}>
                  {s.label}
                  <span className="rounded bg-sand px-1.5 py-0.5 text-[11px] leading-none font-medium text-muted">tezliklə</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Page frame shared by the admin screens: title, a line of numbers (and on the right whatever the page adds), tabs. */
export function AdminPage({ title, subtitle, aside, children }: { title: string; subtitle: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-6 pt-5 pb-10 md:pt-8 md:pb-14">
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest md:text-[30px]">{title}</h1>
            <p className="text-[15px] leading-[1.5] text-ink-soft">{subtitle}</p>
          </div>
          {aside}
        </div>
        <AdminTabs />
      </div>
      {children}
    </div>
  )
}

/** Status filter chip ("Gözləyən · 12", "Açıq · 7"). */
export function Chip({ active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button type="button" aria-pressed={active} className={chipClass(active, className)} {...rest}>
      {children}
    </button>
  )
}

/** 23 px / 1.35 panel title ("Rədd səbəbi", "Araşdırma və qərar") with optional 15 px muted subtitle. */
export function PanelTitle({ children, subtitle, id }: { children: ReactNode; subtitle?: ReactNode; id?: string }) {
  return (
    <div className="w-full text-ink">
      <h2 id={id} className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest">
        {children}
      </h2>
      {subtitle && <p className="text-[15px] leading-[1.6] text-muted">{subtitle}</p>}
    </div>
  )
}
