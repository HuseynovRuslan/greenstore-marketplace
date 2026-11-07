'use client'

import { Children, type CSSProperties, type ReactNode } from 'react'
import { useRevealOnce } from '@/hooks/useRevealOnce'

/**
 * A grid (or any block) whose children fade up once, 60 ms apart, when it scrolls into view (useRevealOnce).
 * Each child gets a wrapper carrying the motion, so the cards themselves keep their own hover transitions.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRevealOnce<HTMLDivElement>()
  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) => (
        <div className="gs-reveal-item min-w-0" style={{ '--i': i } as CSSProperties}>
          {child}
        </div>
      ))}
    </div>
  )
}
