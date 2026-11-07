import type { ReactNode } from 'react'
import { AdminFrame } from '@/components/layout/Frames'

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>
}
