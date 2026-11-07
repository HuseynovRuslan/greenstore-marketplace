import { ClientGate } from '@/components/layout/ClientGate'
import { PostingDone } from '@/features/posting/PostingDone'
import { PostingSkeleton } from '@/features/posting/PostingSkeleton'
import { privateMetadata } from '@/seo/metadata'

export const metadata = privateMetadata('Elan yoxlamaya göndərildi')

/** Confirmation after «Elanı göndər». Private and driven by browser storage: rendered after hydration. */
export default function Page() {
  return (
    <ClientGate fallback={<PostingSkeleton />}>
      <PostingDone />
    </ClientGate>
  )
}
