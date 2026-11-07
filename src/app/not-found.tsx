import type { Metadata } from 'next'
import { MainFrame } from '@/components/layout/Frames'
import NotFoundPage from '@/views/NotFoundPage'

export const metadata: Metadata = { title: 'Səhifə tapılmadı', robots: { index: false, follow: false } }

/** Unknown URLs and `notFound()` without a closer boundary: HTTP 404 with the main header and compact footer. */
export default function NotFound() {
  return (
    <MainFrame>
      <NotFoundPage />
    </MainFrame>
  )
}
