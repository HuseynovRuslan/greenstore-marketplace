import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/format'

interface SectionHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** "Bütün elanlara bax →" style link, hidden on mobile where a full-width button is used instead */
  action?: { label: string; to: string }
  as?: 'h1' | 'h2'
  className?: string
}

/* Figma "Bölmə başlığı": 30 px / 1.35 title (23 px on 390), 15 px / 1.6 muted subtitle, 13 px semibold link */
export function SectionHeader({ title, subtitle, action, as: Tag = 'h2', className }: SectionHeaderProps) {
  return (
    <div className={cn('flex w-full items-center gap-3 text-ink', className)}>
      <div className="min-w-0 flex-1">
        <Tag className="text-[23px] leading-[1.35] font-normal md:text-[30px]">{title}</Tag>
        {subtitle && <p className="text-[15px] leading-[1.43] text-muted">{subtitle}</p>}
      </div>
      {action && (
        <Link
          to={action.to}
          className="hidden shrink-0 text-[13px] leading-[1.5] font-semibold whitespace-nowrap hover:text-olive md:inline"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
