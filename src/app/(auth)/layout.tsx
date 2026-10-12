import type { ReactNode } from 'react'
import { AuthFrame } from '@/components/layout/Frames'

export default function Layout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>
}
