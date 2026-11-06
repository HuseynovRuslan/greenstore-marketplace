import '@testing-library/jest-dom/vitest'
import { MotionGlobalConfig } from 'motion/react'

// Motion animations finish at once in tests: exits (AnimatePresence) unmount right away and nothing waits on frames.
MotionGlobalConfig.skipAnimations = true
