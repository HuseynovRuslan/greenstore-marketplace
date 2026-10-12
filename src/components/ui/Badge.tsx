import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

export type BadgeTone = 'vip' | 'success' | 'warning' | 'danger' | 'neutral'

/* Figma "Nişan": 12 px semibold, px 9 / py 5, radius 5 */
const tones: Record<BadgeTone, string> = {
  vip: 'bg-vip text-olive',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-mint text-forest',
}

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-start rounded-[5px] px-[9px] py-[5px] text-xs leading-[normal] font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
