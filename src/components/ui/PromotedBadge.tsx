import { Rocket } from 'lucide-react'
import { cn } from '@/lib/format'

/**
 * «Önə çıxan» (a listing the seller paid to push forward): the rocket of the header link and the home section
 * heading, olive text on the vip tint (5.0:1). `card` is the smaller photo overlay of the Variant 2 card; below
 * 360 px it keeps only the rocket (the word stays for screen readers) so it clears the favourite button.
 */
export function PromotedBadge({ size = 'default', className }: { size?: 'default' | 'card'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-[5px] rounded-[5px] bg-vip text-xs leading-[normal] font-semibold whitespace-nowrap text-olive-text',
        size === 'card' ? 'px-[7px] py-[3px] md:px-2 md:py-1' : 'px-[9px] py-[5px]',
        className,
      )}
    >
      <Rocket aria-hidden size={12} strokeWidth={2.2} className="shrink-0" />
      <span className={cn(size === 'card' && 'max-[359px]:sr-only')}>Önə çıxan</span>
    </span>
  )
}
