import type { ReactNode } from 'react'
import { WorkflowFrame } from '@/components/layout/Frames'

export default function Layout({ children }: { children: ReactNode }) {
  return <WorkflowFrame>{children}</WorkflowFrame>
}
