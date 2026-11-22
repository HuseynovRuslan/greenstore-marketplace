import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cityName } from '@/data/cities'
import { getRepository } from '@/services/repository'
import { parsePage, withPage } from '@/seo/catalog'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd, sellerJsonLd } from '@/seo/jsonld'
import { describe, pageMetadata } from '@/seo/metadata'
import { toSearchParams, type RawSearchParams } from '@/lib/searchParams'
import { loadSellerListings } from '@/features/seller/sellerListingQuery'
import SellerPage, { sellerCrumbs } from '@/views/SellerPage'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params
  const seller = await getRepository().getSeller(slug)
  if (!seller) return { title: 'Satıcı tapılmadı', robots: { index: false, follow: false } }
  const query = toSearchParams(await searchParams)
  // Tab and in-seller search variants are not indexed; sort is presentation only; pages are self-canonical.
  const filtered = Boolean(query.get('kateqoriya') || query.get('q'))
  const page = parsePage(query.get('sehife'))
  const location = seller.address ?? cityName(seller.cityId)
  const summary = [seller.kind, location, `${seller.activeListings} aktiv elan`].filter(Boolean).join(' · ')
  return pageMetadata({
    title: page > 1 ? `${seller.name} — səhifə ${page}` : seller.name,
    description: describe(seller.about ? `${summary}. ${seller.about}` : summary),
    canonical: filtered ? undefined : withPage(`/saticilar/${seller.slug}`, page),
    index: !filtered,
    // A new business has no photo yet ("" from the API): the site's default image then.
    images: seller.coverImage || seller.image ? [{ url: seller.coverImage || seller.image, alt: seller.name }] : undefined,
  })
}

/** /saticilar/[slug] — public seller profile. Unknown sellers are a 404 ("Satıcı tapılmadı", see not-found.tsx). */
export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params
  const repo = getRepository()
  const seller = await repo.getSeller(slug)
  if (!seller) notFound()
  // The services this business publishes, and its listings (narrowed and paged in the browser).
  const [services, listings] = await Promise.all([repo.listProviderServices(seller.id), loadSellerListings(repo, seller.id)])
  const business = sellerJsonLd(seller)
  const crumbs = sellerCrumbs(seller)
  return (
    <>
      <JsonLd data={[crumbsJsonLd(crumbs), ...(business ? [business] : [])]} />
      <SellerPage seller={seller} listings={listings} listingQuery={toSearchParams(await searchParams).toString()} services={services} />
    </>
  )
}
