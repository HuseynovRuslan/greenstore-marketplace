import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { serviceCategories } from '@/data/services'
import { getRepository } from '@/services/repository'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd, serviceJsonLd } from '@/seo/jsonld'
import { describe, pageMetadata } from '@/seo/metadata'
import ServiceDetailPage, { serviceCrumbs } from '@/views/ServiceDetailPage'

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const services = await getRepository().listServices()
  return services.map((s) => ({ slug: s.slug }))
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

/** /xidmetler/[slug] — service page; unknown slugs are a 404. */
export default async function Page({ params }: Props) {
  const { slug } = await params
  const repo = getRepository()
  const service = await repo.getService(slug)
  if (!service) notFound()
  const provider = await repo.getServiceProvider(service.providerId)
  const categoryName = serviceCategories.find((c) => c.id === service.categoryId)?.name
  return (
    <>
      <JsonLd
        data={[
          crumbsJsonLd([...serviceCrumbs(service), { label: service.title }]),
          serviceJsonLd(service, { categoryName, provider }),
        ]}
      />
      <ServiceDetailPage service={service} provider={provider} />
    </>
  )
}
