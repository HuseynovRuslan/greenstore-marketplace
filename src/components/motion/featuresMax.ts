/*
 * domMax = domAnimation + drag / pan gestures + layout animations. Loaded only where they are used (the phone bottom
 * sheet's drag-to-dismiss, the catalogue's chip row), on idle, by MotionFeatures.
 */
import { domMax } from 'motion/react'

export default domMax
