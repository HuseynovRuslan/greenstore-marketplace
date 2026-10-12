import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { chipClass } from './lib'

const sections: Array<{ label: string; to?: string; paths: string[] }> = [
  { label: 'Moderasiya', to: '/idareetme/moderasiya', paths: ['/idareetme', '/idareetme/moderasiya'] },
  { label: 'Kateqoriyalar', to: '/idareetme/kateqoriyalar', paths: ['/idareetme/kateqoriyalar'] },
  { label: 'Şikayətlər', to: '/idareetme/sikayetler', paths: ['/idareetme/sikayetler'] },
  /* "İstifadəçilər" has no screen in the design yet — shown as in Figma but not navigable. */
  { label: 'İstifadəçilər', paths: [] },
]

/** Figma "Bölmə seçimləri" — admin section tabs (Moderasiya · Kateqoriyalar · Şikayətlər · İstifadəçilər). */
export function AdminTabs() {
  const { pathname } = useLocation()
  const current = pathname.replace(/\/+$/, '') || '/'
  return (
    <nav aria-label="İdarəetmə bölmələri" className="w-full">
      <ul className="flex w-full flex-wrap items-start gap-2">
        {sections.map((s) => {
          const active = s.paths.includes(current)
          return (
            <li key={s.label}>
              {s.to ? (
                <Link to={s.to} aria-current={active ? 'page' : undefined} className={chipClass(active)}>
                  {s.label}
                </Link>
              ) : (
                <span aria-disabled="true" title="Bu bölmə hazırlanır" className={chipClass(false, 'cursor-not-allowed hover:bg-mint')}>
                  {s.label}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Page frame shared by the three admin screens: "Səhifə məzmunu" (px 64 · py 36 · gap 28) + title + section tabs. */
export function AdminPage({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-7 pb-10 md:pt-[51px] md:pb-[51px]">
      <SectionHeader as="h1" title={title} subtitle={subtitle} />
      <AdminTabs />
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
      <h2 id={id} className="text-[23px] leading-[1.35] font-normal">
        {children}
      </h2>
      {subtitle && <p className="text-[15px] leading-[1.6] text-muted">{subtitle}</p>}
    </div>
  )
}
