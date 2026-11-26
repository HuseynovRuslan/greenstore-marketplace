import type { ReactNode } from 'react'
import { CompactFrame } from '@/components/layout/Frames'

/** Login, registration, password reset: the form comes first, the footer is the compact one. */
export default function Layout({ children }: { children: ReactNode }) {
  return <CompactFrame>{children}</CompactFrame>
}
