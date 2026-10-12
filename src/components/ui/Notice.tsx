import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

export type NoticeTone = 'success' | 'warning' | 'danger' | 'info'

const tones: Record<NoticeTone, string> = {
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  info: 'bg-mint',
}

interface NoticeProps {
  tone?: NoticeTone
  title: ReactNode
  children?: ReactNode
  className?: string
}

/* Figma "Məlumat bildirişi": p 18, radius 8, 14 px semibold title + 13 px body, leading 1.6.
 * Tones: success #eaf5ec, warning #fbf2dc, danger #faece9 (live regions) and the static neutral "info" #eaf0e9
 * used for hints such as "Alışdan əvvəl dəqiqləşdirin" or "Moderasiya qeydi". */
export function Notice({ tone = 'success', title, children, className }: NoticeProps) {
  const role = tone === 'danger' ? 'alert' : tone === 'info' ? undefined : 'status'
  return (
    <div role={role} className={cn('w-full rounded-lg p-[18px] text-ink', tones[tone], className)}>
      <p className="text-sm leading-[1.6] font-semibold">{title}</p>
      {children && <div className="text-[13px] leading-[1.6]">{children}</div>}
    </div>
  )
}

/** Neutral mint notice — shorthand for `<Notice tone="info">`. */
export function InfoNotice(props: Omit<NoticeProps, 'tone'>) {
  return <Notice tone="info" {...props} />
}
