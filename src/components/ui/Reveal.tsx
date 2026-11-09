'use client'

import { Children, type CSSProperties, type ReactNode } from 'react'
import { useRevealOnce } from '@/hooks/useRevealOnce'

interface RevealProps {
  children: ReactNode
  className?: string
  /** A list (`ol` / `ul`) wraps each child in an `li`, so the list keeps its semantics. */
  as?: 'div' | 'ol' | 'ul'
}

/**
 * A grid (or any block) whose children fade up once, 60 ms apart, when it scrolls into view (useRevealOnce).
 * Each child gets a wrapper carrying the motion, so the cards themselves keep their own hover transitions.
 */
export function Reveal({ children, className, as: Tag = 'div' }: RevealProps) {
  const ref = useRevealOnce<HTMLDivElement & HTMLOListElement & HTMLUListElement>()
  const Item = Tag === 'div' ? 'div' : 'li'
  return (
    <Tag ref={ref} className={className}>
      {Children.map(children, (child, i) => (
        <Item className="gs-reveal-item min-w-0" style={{ '--i': i } as CSSProperties}>
          {child}
        </Item>
      ))}
    </Tag>
  )
}
