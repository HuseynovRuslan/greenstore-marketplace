import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/format'

/*
 * Small building blocks shared by the auth and account screens.
 * (Candidates for `src/components/ui` — kept local because shared files are owned elsewhere.)
 */

/** Page wrapper for the account/auth frames: 1440 gutter, 36 px (+15 px spacer) top, 36 px bottom, 28 px rhythm. */
export function AccountPage({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('page-x mx-auto flex w-full max-w-[1440px] flex-col gap-7 pt-[39px] pb-6 md:pt-[51px] md:pb-9', className)}>
      {children}
    </div>
  )
}

/**
 * Figma draws checkboxes as the "☑ / ☐" glyphs (13–14 px, grey). A native checkbox tinted with the muted
 * text colour reproduces that look while staying accessible.
 */
export function Checkbox({ label, className, ...rest }: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={cn('inline-flex cursor-pointer items-start gap-[5px] text-ink', className)}>
      <input type="checkbox" className="m-0 mt-[0.28em] size-[13px] shrink-0 cursor-pointer accent-muted" {...rest} />
      <span>{label}</span>
    </label>
  )
}

/** 23 px panel title ("Şirkət və əlaqə məlumatları", "Təhlükəsizlik", "Bildiriş seçimləri"). */
export function PanelTitle({ children, id, as: Tag = 'h2' }: { children: ReactNode; id?: string; as?: 'h2' | 'h3' }) {
  return (
    <Tag id={id} className="w-full text-[23px] leading-[1.35] font-normal text-ink">
      {children}
    </Tag>
  )
}

/**
 * Figma "Məlumat paneli" with the stroke inside the box: 1 px border + 23 px padding = 24 px from the edge,
 * so the panel keeps the exact Figma height (the shared `Panel` adds the border on top of p-24).
 * No default gap — pass the Figma one (gap-5 = 20 px in most panels).
 */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col items-start rounded-xl border border-line bg-surface p-[23px]', className)} {...rest} />
}
