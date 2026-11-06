'use client'

import type { ReactNode } from 'react'
import { LazyMotion, type LazyFeatureBundle } from 'motion/react'

/** Below 640 px the Dialog is a bottom sheet (and the only place that drags). */
export const SHEET_QUERY = '(max-width: 639.98px)'

/** Waits for an idle moment (or 200 ms where requestIdleCallback is missing, as in Safari before 18). */
const idle = () =>
  new Promise<void>((resolve) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: 1500 })
    else window.setTimeout(resolve, 200)
  })

const loadDomAnimation: LazyFeatureBundle = () => import('./features').then((bundle) => bundle.default)

/** drag + layout (≈ 14 KB gzip over domAnimation), fetched on idle so it never competes with the first load. */
export const loadDomMax: LazyFeatureBundle = () => idle().then(() => import('./featuresMax').then((bundle) => bundle.default))

/** A Dialog drags only as a phone bottom sheet; wider screens just animate a centred dialog. */
export const loadForDialog: LazyFeatureBundle = () => (window.matchMedia?.(SHEET_QUERY).matches ? loadDomMax() : loadDomAnimation())

/**
 * A nested LazyMotion for the leaves that need more than the app-wide domAnimation (MotionProvider): features load
 * once, globally, so later instances reuse them. Its `m` components render statically until the bundle arrives.
 */
export function MotionFeatures({ load, children }: { load: LazyFeatureBundle; children: ReactNode }) {
  return <LazyMotion features={load}>{children}</LazyMotion>
}
