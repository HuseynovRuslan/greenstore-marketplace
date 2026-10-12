import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

/**
 * Figma "Giriş fotoşəkli" / "Qeydiyyat təqdimatı": photo (radius 8) + 30 px heading with a 15 px muted lead,
 * 24 px apart. Hidden below 768 px so the form comes first on phones.
 */
export function AuthIntro({
  image,
  imageClassName,
  title,
  lead,
  children,
}: {
  image: string
  /** Aspect ratio of the Figma photo (it scales with the column on tablet). */
  imageClassName: string
  title: string
  lead: string
  children?: ReactNode
}) {
  return (
    <aside className="hidden min-w-0 flex-col items-start gap-6 md:flex">
      <img src={image} alt="" className={cn('w-full shrink-0 rounded-lg object-cover', imageClassName)} />
      <div className="w-full text-ink">
        <h2 className="text-[30px] leading-[1.35] font-normal">{title}</h2>
        <p className="text-[15px] leading-[1.6] text-muted">{lead}</p>
      </div>
      {children}
    </aside>
  )
}
