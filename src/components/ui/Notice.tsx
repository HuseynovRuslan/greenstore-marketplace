import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

export type NoticeTone = 'success' | 'warning' | 'danger'

const tones: Record<NoticeTone, string> = {
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
}

/* Figma "Məlumat bildirişi": p 18, radius 8, 14 px semibold title + 13 px body, leading 1.6 */
export function Notice({ tone = 'success', title, children, className }: { tone?: NoticeTone; title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('w-full rounded-lg p-[18px] text-ink', tones[tone], className)}>
      <p className="text-sm leading-[1.6] font-semibold">{title}</p>
      {children && <div className="text-[13px] leading-[1.6]">{children}</div>}
    </div>
  )
}
