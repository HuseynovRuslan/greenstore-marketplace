import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { serviceCategories } from '@/data/services'
import { formatNumber } from '@/lib/format'
import { toSearchParams, type RawSearchParams } from '@/lib/searchParams'
import { getProductMatches } from '@/features/services/productMatches'
import { loadProviderNames } from '@/features/services/providerNames'
import { hasActiveFilters, parseServiceQuery, type ServiceQuery } from '@/features/services/query'
import { getRepository } from '@/services/repository'
import { parsePage, withPage } from '@/seo/catalog'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd } from '@/seo/jsonld'
import { pageMetadata } from '@/seo/metadata'
import ServicesPage, { servicesCrumbs } from '@/views/ServicesPage'

type Props = { searchParams: Promise<RawSearchParams> }

/** «Hamısı» and every service type with the other filters kept: the sidebar's counts. */
async function loadServiceCategoryCounts(parsed: ServiceQuery): Promise<Record<string, number>> {
  const repo = getRepository()
  const ids = ['', ...serviceCategories.map((c) => c.id)]
  const totals = await Promise.all(ids.map(async (id) => (await repo.searchServices({ ...parsed, categoryId: id || undefined, page: 1 })).total))
  return Object.fromEntries(ids.map((id, i) => [id, totals[i]]))
}

const load = cache(async (query: string) => {
  const repo = getRepository()
  const parsed = parseServiceQuery(new URLSearchParams(query))
  const result = await repo.searchServices(parsed)
  // No service for the word: maybe it is a product («zeytun»); the empty state points there.
  const productMatches = result.total === 0 ? await getProductMatches(parsed.q, parsed.cityId) : undefined
  return { parsed, result, productMatches, outOfRange: parsed.page > result.pageCount }
})

/** The platform's number of services, for the description («Azərbaycanda 95 xidmət elanı»). */
const platformTotal = cache(async () => (await getRepository().searchServices({ q: '', tab: 'all', sort: 'newest', page: 1 })).displayTotal)

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = toSearchParams(await searchParams)
  const { parsed, outOfRange } = await load(query.toString())
  if (outOfRange) return { title: 'Səhifə tapılmadı', robots: { index: false, follow: false } }
  // Only the unfiltered catalogue (and its pages) is indexable; sort is presentation only.
  const filtered = hasActiveFilters(parsed)
  const page = parsePage(query.get('sehife'))
  return pageMetadata({
    title: page > 1 ? `Bağ xidmətləri — səhifə ${page}` : 'Bağ xidmətləri: landşaft, əkin, qazon, suvarma',
    description: `Bağınızın işini peşəkara həvalə edin: dizayndan gündəlik qulluğa — Azərbaycanda ${formatNumber(await platformTotal())} xidmət elanı.`,
    canonical: filtered ? undefined : withPage('/xidmetler', page),
    index: !filtered,
  })
}

/** /xidmetler — services catalogue; state in the query string, results and pagination server-rendered. */
export default async function Page({ searchParams }: Props) {
  const query = toSearchParams(await searchParams).toString()
  const { parsed, result, productMatches, outOfRange } = await load(query)
  if (outOfRange) notFound()
  const [categoryCounts, providerNames] = await Promise.all([loadServiceCategoryCounts(parsed), loadProviderNames(getRepository(), result.items)])
  return (
    <>
      <JsonLd data={crumbsJsonLd(servicesCrumbs)} />
      <ServicesPage query={query} parsed={parsed} result={result} productMatches={productMatches} categoryCounts={categoryCounts} providerNames={providerNames} />
    </>
  )
}
