import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import { listingGallery } from '@/features/listing/detail'
import { formatPrice } from '@/lib/format'
import { ViewBeacon } from '@/features/listing/ViewBeacon'
import { getRepository } from '@/services/repository'
import { dataSource } from '@/seo/env'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd, listingJsonLd } from '@/seo/jsonld'
import { describe, pageMetadata } from '@/seo/metadata'
import { prerenderedSlugs } from '@/seo/sitemap'
import { ListingDetail, listingCrumbs } from '@/views/ListingDetailPage'

type Props = { params: Promise<{ slug: string }> }

/**
 * The demo's public listings are prerendered; with the API every listing page renders on its first visit and is then
 * cached (backend-contract.md 1.1). Unknown slugs end in a 404.
 */
export async function generateStaticParams() {
  return prerenderedSlugs(getRepository(), 'listing')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const listing = await getRepository().getPublicListing(slug)
  if (!listing) return { title: 'Elan tapılmadı', robots: { index: false, follow: false } }
  const facts = [formatPrice(listing.price), ...listing.attributes, cityName(listing.cityId)].join(' · ')
  const description = describe([facts, ...(listing.description ?? [])].join('. '))
  const images = listingGallery(listing)
  return pageMetadata({
    title: listing.title,
    description,
    canonical: `/elanlar/${listing.slug}`,
    images: images.slice(0, 1).map((url) => ({ url, alt: listing.title })),
  })
}

/**
 * /elanlar/[slug] — listing page. Unknown, pending and expired listings are a 404 (see not-found.tsx). An old slug
 * (the title changed; the number at its end still finds the listing) moves to the current one with a 308.
 */
export default async function Page({ params }: Props) {
  const { slug } = await params
  const repo = getRepository()
  const listing = await repo.getPublicListing(slug)
  if (!listing) notFound()
  if (listing.slug !== slug) permanentRedirect(`/elanlar/${listing.slug}`)

  const [seller, related] = await Promise.all([listing.sellerId ? repo.getSellerById(listing.sellerId) : undefined, repo.getRelatedListings(listing)])
  const category = categoryById(listing.categoryId)
  const crumbs = listingCrumbs(listing, category)

  return (
    <>
      <JsonLd
        data={[
          crumbsJsonLd(crumbs),
          listingJsonLd(listing, { images: listingGallery(listing), category, seller }),
        ]}
      />
      <ListingDetail listing={listing} seller={seller} category={category} others={related.fromSeller} similar={related.similar} />
      {/* The API counts views (backend-contract.md 3.4); the demo has nothing to count. */}
      {dataSource() === 'api' && <ViewBeacon listingId={listing.id} />}
    </>
  )
}
