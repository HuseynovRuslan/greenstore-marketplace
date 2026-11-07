'use client'

import type { ReactNode } from 'react'
import { LazyMotion, MotionConfig } from 'motion/react'

/** domAnimation arrives in its own chunk once the page is interactive; `m` components render statically until then. */
const loadFeatures = () => import('./features').then((bundle) => bundle.default)

/**
 * App-wide motion setup (root layout). MotionConfig reducedMotion="user": with the OS "reduce motion" setting, Motion
 * skips transform and layout animations and keeps opacity. LazyMotion strict: only the light `m` components are
 * allowed (a full `motion.*` component throws), so the animation features stay out of the first load. Server
 * components pass through as children; `m` is used in client leaves only.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
