import { connection } from 'next/server'
import { ClientGate } from '@/components/layout/ClientGate'
import { SessionFallback } from '@/components/layout/SessionFallback'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { ListingSkeleton } from '@/views/ListingSkeleton'
import { ownerPreviewPath } from '@/features/listing/ownerPreview'
import { OwnerListingPreview } from '@/features/listing/OwnerListingPreview'
import { privateMetadata } from '@/seo/metadata'

export const metadata = privateMetadata('Elanın önizləməsi')

type Props = { params: Promise<{ slug: string }> }

/**
 * Owner preview of a listing. Private (under /kabinet: noindex header, robots.txt disallow, not in the sitemap) and
 * rendered per request, so preview URLs are never prerendered or cached. Ownership is checked in the browser.
 */
export default async function Page({ params }: Props) {
  await connection()
  const { slug } = await params
  return (
    <ClientGate fallback={<SessionFallback guest={<SignInPrompt next={ownerPreviewPath(slug)} />} user={<ListingSkeleton />} />}>
      <OwnerListingPreview slug={slug} />
    </ClientGate>
  )
}
