import type { ReactNode } from 'react'
import { CompactFrame } from '@/components/layout/Frames'

/** «Şəxsi kabinet» (/kabinet…): a workspace, so the compact footer; the public pages have the full one. */
export default function Layout({ children }: { children: ReactNode }) {
  return <CompactFrame>{children}</CompactFrame>
}
