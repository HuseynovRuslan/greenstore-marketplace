import type { ReactNode } from 'react'
import { HomeFrame } from '@/components/layout/Frames'

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeFrame>{children}</HomeFrame>
}
