import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/format'

/* Figma "Məlumat paneli": white, 1 px #dee3d9 border, radius 12, p 24, 20 px gap */
export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col items-start gap-5 rounded-xl border border-line bg-surface p-6', className)} {...rest} />
}
