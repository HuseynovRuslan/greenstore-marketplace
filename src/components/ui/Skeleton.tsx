import type { ReactNode } from 'react'
import { cn } from '@/lib/format'

/*
 * Loading placeholders in the design's skeleton colour (#e8ebe5, `--color-disabled`, Figma "Vizual komponentlər").
 * A bar sits inside a real text element (same font size and line height), so every placeholder line keeps the exact
 * height of the text it stands for and the layout does not move when the content arrives.
 */
const pulse = 'animate-pulse bg-disabled motion-reduce:animate-none'

/** Inline text placeholder: put it inside the element whose text it replaces. Width via `className` (em-based). */
export function SkeletonText({ className }: { className?: string }) {
  return <span aria-hidden className={cn('inline-block h-[0.8em] max-w-full rounded align-middle', pulse, className)} />
}

/** Block placeholder for images, buttons and fields; size via `className`. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cn('rounded-lg', pulse, className)} />
}

/** Wraps a loading frame: announced once as busy, with a visually hidden status for screen readers. */
export function LoadingFrame({ children, label = 'Yüklənir…' }: { children: ReactNode; label?: string }) {
  return (
    <div aria-busy="true" className="w-full">
      <p role="status" className="sr-only">
        {label}
      </p>
      {children}
    </div>
  )
}
