import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { serviceCategories } from '@/data/services'
import { loadProviderNames } from '@/features/services/providerNames'
import { ViewBeacon } from '@/features/listing/ViewBeacon'
import { getRepository } from '@/services/repository'
import { dataSource } from '@/seo/env'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd, serviceJsonLd } from '@/seo/jsonld'
import { describe, pageMetadata } from '@/seo/metadata'
import { prerenderedSlugs } from '@/seo/sitemap'
import ServiceDetailPage, { serviceCrumbs } from '@/views/ServiceDetailPage'

type Props = { params: Promise<{ slug: string }> }

/** Like listings: the demo's services are prerendered, the API's render on their first visit and are cached. */
export async function generateStaticParams() {
  return prerenderedSlugs(getRepository(), 'service')
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const repo = getRepository()
  const service = await repo.getService(slug)
  if (!service) return { title: 'Səhifə tapılmadı', robots: { index: false, follow: false } }
  const provider = await repo.getServiceProvider(service.providerId)
  const facts = [service.priceLabel, provider?.name, service.areas.join(', ')].filter(Boolean).join(' · ')
  return pageMetadata({
    title: service.title,
    description: describe([facts, ...(service.description ?? [])].join('. ')),
    canonical: `/xidmetler/${service.slug}`,
    images: [{ url: service.cover, alt: service.title }],
  })
}

/** /xidmetler/[slug] — service page; unknown slugs are a 404, an old slug moves to the current one (308). */
export default async function Page({ params }: Props) {
  const { slug } = await params
  const repo = getRepository()
  const service = await repo.getService(slug)
  if (!service) notFound()
  if (service.slug !== slug) permanentRedirect(`/xidmetler/${service.slug}`)
  const [provider, related] = await Promise.all([repo.getServiceProvider(service.providerId), repo.getRelatedServices(service)])
  const [seller, providerNames] = await Promise.all([
    provider?.sellerId ? repo.getSellerById(provider.sellerId) : undefined,
    loadProviderNames(repo, [...related.fromProvider, ...related.similar]),
  ])
  const categoryName = serviceCategories.find((c) => c.id === service.categoryId)?.name
  return (
    <>
      <JsonLd
        data={[
          crumbsJsonLd([...serviceCrumbs(service), { label: service.title }]),
          serviceJsonLd(service, { categoryName, provider }),
        ]}
      />
      <ServiceDetailPage
        service={service}
        provider={provider}
        seller={seller}
        others={related.fromProvider}
        similar={related.similar}
        providerNames={providerNames}
      />
      {/* A service is a listing on the API: its page views count for its owner too (backend-contract.md 3.4). */}
      {dataSource() === 'api' && <ViewBeacon listingId={service.id} />}
    </>
  )
}
