import { ClientGate } from '@/components/layout/ClientGate'
import { PostingSkeleton } from '@/features/posting/PostingSkeleton'
import { PostingWizard } from '@/features/posting/PostingWizard'
import { privateMetadata } from '@/seo/metadata'

export const metadata = privateMetadata('Elan yerləşdir')

/** /elan-yerlesdir — step 1 of the posting flow. The draft lives in browser storage, so it renders after hydration. */
export default function Page() {
  return (
    <ClientGate fallback={<PostingSkeleton />}>
      <PostingWizard key={1} step={1} />
    </ClientGate>
  )
}
