import type { ReactNode } from 'react'
import { MainFrame } from '@/components/layout/MainFrame'

export default function Layout({ children }: { children: ReactNode }) {
  return <MainFrame>{children}</MainFrame>
}
