import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { formatNumber } from '@/lib/format'
import { toSearchParams, type RawSearchParams } from '@/lib/searchParams'
import { hasActiveFilters, parseServiceQuery, platformServiceTotal } from '@/features/services/query'
import { getRepository } from '@/services/repository'
import { parsePage, withPage } from '@/seo/catalog'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd } from '@/seo/jsonld'
import { pageMetadata } from '@/seo/metadata'
import ServicesPage, { servicesCrumbs } from '@/views/ServicesPage'

type Props = { searchParams: Promise<RawSearchParams> }

const load = cache(async (query: string) => {
  const parsed = parseServiceQuery(new URLSearchParams(query))
  const result = await getRepository().searchServices(parsed)
  return { parsed, result, outOfRange: parsed.page > result.pageCount }
})

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = toSearchParams(await searchParams)
  const { parsed, outOfRange } = await load(query.toString())
  if (outOfRange) return { title: 'Səhifə tapılmadı', robots: { index: false, follow: false } }
  // Only the unfiltered catalogue (and its pages) is indexable; sort is presentation only.
  const filtered = hasActiveFilters(parsed)
  const page = parsePage(query.get('sehife'))
  return pageMetadata({
    title: page > 1 ? `Landşaft və bağçılıq xidmətləri — səhifə ${page}` : 'Landşaft və bağçılıq xidmətləri',
    description: `Bağınızın işini peşəkara həvalə edin: dizayndan gündəlik qulluğa — Azərbaycanda ${formatNumber(platformServiceTotal)} xidmət elanı.`,
    canonical: filtered ? undefined : withPage('/xidmetler', page),
    index: !filtered,
  })
}

/** /xidmetler — services catalogue; state in the query string, results and pagination server-rendered. */
export default async function Page({ searchParams }: Props) {
  const query = toSearchParams(await searchParams).toString()
  const { result, outOfRange } = await load(query)
  if (outOfRange) notFound()
  return (
    <>
      <JsonLd data={crumbsJsonLd(servicesCrumbs)} />
      <ServicesPage query={query} result={result} />
    </>
  )
}
