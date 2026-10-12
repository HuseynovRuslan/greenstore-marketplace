import { ClientGate } from '@/components/layout/ClientGate'
import { PageSkeleton } from '@/views/ListingSkeleton'
import { privateMetadata } from '@/seo/metadata'
import PostAdSubmittedPage from '@/views/post-ad/PostAdSubmittedPage'

export const metadata = privateMetadata('Elan yoxlamaya göndərildi')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate fallback={<PageSkeleton />}>
      <PostAdSubmittedPage />
    </ClientGate>
  )
}
