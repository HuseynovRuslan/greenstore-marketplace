import { ClientGate } from '@/components/layout/ClientGate'
import { privateMetadata } from '@/seo/metadata'
import PostAdPage from '@/views/post-ad/PostAdPage'

export const metadata = privateMetadata('Elan yerləşdir')

/** /elan-yerlesdir — step 1 of the wizard. The draft lives in localStorage, so the wizard renders after hydration. */
export default function Page() {
  return (
    <ClientGate>
      <PostAdPage step={1} />
    </ClientGate>
  )
}
