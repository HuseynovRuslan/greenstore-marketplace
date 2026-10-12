import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SearchPage, { searchCrumbs } from '@/views/SearchPage'
import { catalogRule } from '@/seo/catalog'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd } from '@/seo/jsonld'
import { pageMetadata } from '@/seo/metadata'
import { toSearchParams, type RawSearchParams } from '@/lib/searchParams'
import { catalogCopy, loadCatalog } from './catalog'

type Props = { searchParams: Promise<RawSearchParams> }

async function load(searchParams: Props['searchParams']) {
  const params = toSearchParams(await searchParams)
  const page = params.get('sehife')
  params.delete('sehife')
  const query = params.toString()
  const data = await loadCatalog(query, page)
  return { ...data, query, urlQuery: toSearchParams(await searchParams).toString() }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { state, result, requestedPage, outOfRange } = await load(searchParams)
  if (outOfRange) return { title: 'Səhifə tapılmadı', robots: { index: false, follow: false } }
  const rule = catalogRule(state, result.total, requestedPage)
  const { title, description } = catalogCopy(state, result.total, requestedPage)
  return pageMetadata({ title, description, canonical: rule.canonical, index: rule.index, follow: rule.follow })
}

/** /elanlar — product catalogue. Filters live in the query string; results and pagination are server-rendered. */
export default async function Page({ searchParams }: Props) {
  const { state, view, result, outOfRange, query, urlQuery } = await load(searchParams)
  if (outOfRange) notFound()
  const crumbs = searchCrumbs(state)
  return (
    <>
      <JsonLd data={crumbsJsonLd(crumbs)} />
      <SearchPage state={state} view={view} result={result} stateQuery={query} basePath="/elanlar" urlQuery={urlQuery} crumbs={crumbs} />
    </>
  )
}
