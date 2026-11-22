import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { ClientGate } from '@/components/layout/ClientGate'
import { SessionFallback } from '@/components/layout/SessionFallback'
import { categoryById } from '@/data/categories'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { ListingDetail } from '@/views/ListingDetailPage'
import { ListingSkeleton } from '@/views/ListingSkeleton'
import { ownerPreviewPath } from '@/features/listing/ownerPreview'
import { OwnerListingPreview } from '@/features/listing/OwnerListingPreview'
import { getRepository } from '@/services/repository'
import { dataSource } from '@/seo/env'
import { privateMetadata } from '@/seo/metadata'
import type { OwnListing } from '@/types'

export const metadata = privateMetadata('Elanın önizləməsi')

type Props = { params: Promise<{ slug: string }> }

/** The owner's listing a preview address names: its current slug, or the number at the end of an older one. */
function findOwn(listings: OwnListing[], slug: string): OwnListing | undefined {
  const number = Number(/-(\d+)$/.exec(slug)?.[1] ?? Number.NaN)
  return listings.find((l) => l.slug === slug) ?? listings.find((l) => l.number === number)
}

/**
 * Owner preview of a listing. Private (under /kabinet: noindex header, robots.txt disallow, not in the sitemap) and
 * rendered per request, so preview URLs are never prerendered or cached.
 * - DATA_SOURCE=api: the session's own listings on the server (`GET /me/listings`), any status; another account's
 *   listing is «tapılmadı» with HTTP 404 (./not-found.tsx). The address names a slug, and `GET /me/listings/{id}`
 *   takes an id, so the list is read.
 * - DATA_SOURCE=mock: ownership is checked in the browser (the demo's session and sent listings live there).
 */
export default async function Page({ params }: Props) {
  await connection()
  const { slug } = await params
  if (dataSource() === 'api') {
    const repo = getRepository()
    if (!(await repo.getMe())) return <SignInPrompt next={ownerPreviewPath(slug)} />
    const listing = findOwn(await repo.listOwnListings(), slug)
    if (!listing) notFound()
    const seller = listing.sellerId ? await repo.getSellerById(listing.sellerId) : undefined
    return <ListingDetail key={listing.id} mode="owner" listing={listing} seller={seller} category={categoryById(listing.categoryId)} others={[]} similar={[]} />
  }
  return (
    <ClientGate fallback={<SessionFallback guest={<SignInPrompt next={ownerPreviewPath(slug)} />} user={<ListingSkeleton />} />}>
      <OwnerListingPreview slug={slug} />
    </ClientGate>
  )
}
