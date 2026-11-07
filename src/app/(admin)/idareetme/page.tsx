import { ClientGate } from '@/components/layout/ClientGate'
import { PageSkeleton } from '@/views/ListingSkeleton'
import { privateMetadata } from '@/seo/metadata'
import ModerationPage from '@/views/admin/ModerationPage'

export const metadata = privateMetadata('İdarəetmə · Moderasiya')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate fallback={<PageSkeleton />}>
      <ModerationPage />
    </ClientGate>
  )
}
