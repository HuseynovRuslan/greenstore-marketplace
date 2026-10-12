import { Leaf } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/format'

/* Figma brand mark: Lucide "leaf" 26 px (1 px stroke) + wordmark, Inter Regular 25 px (22 px on mobile), #173f32.
 * The prototype wordmark "YARPAQ" is replaced by the product name "GreenStore". */
export function Logo({ className, showIcon = true }: { className?: string; showIcon?: boolean }) {
  return (
    <Link href="/" aria-label="GreenStore — ana səhifə" className={cn('flex shrink-0 items-center gap-3 text-forest md:gap-[18px]', className)}>
      {showIcon && <Leaf aria-hidden size={26} strokeWidth={1} absoluteStrokeWidth />}
      <span className="text-[22px] leading-[normal] whitespace-nowrap md:text-[25px]">GreenStore</span>
    </Link>
  )
}
