/*
 * Motion feature bundles, each loaded on demand by a LazyMotion (MotionProvider, MotionMax) so they never weigh on
 * the first load. domAnimation: animations, exit animations, variants, tap / hover / focus gestures.
 */
import { domAnimation } from 'motion/react'

export default domAnimation
