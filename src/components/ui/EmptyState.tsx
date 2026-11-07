import type { ReactNode } from 'react'
import { Panel } from './Panel'

/* Figma "Boş vəziyyətlər": 30 px icon, 23 px / 1.35 title, 15 px muted body, full-width primary button */
export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <Panel className="w-full max-w-[432px]">
      <span className="text-forest">{icon}</span>
      <h3 className="text-[23px] leading-[1.35] font-normal text-ink">{title}</h3>
      {description && <p className="text-[15px] leading-[1.5] text-muted">{description}</p>}
      {action}
    </Panel>
  )
}

export function CardSkeleton({ label = 'Elanlar yüklənir' }: { label?: string }) {
  return (
    <Panel aria-busy className="w-full">
      <p className="text-[15px] leading-[1.5] font-semibold text-ink">{label}</p>
      <div className="h-[135px] w-full animate-pulse rounded-lg bg-disabled" />
      <div className="h-[14px] w-full animate-pulse rounded bg-disabled" />
      <div className="h-3 w-[200px] animate-pulse rounded bg-disabled" />
    </Panel>
  )
}
