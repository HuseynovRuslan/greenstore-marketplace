import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SearchPage, { searchCrumbs } from '@/views/SearchPage'
import { getRepository } from '@/services/repository'
import { categoryPageRule, categoryPath } from '@/seo/catalog'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd } from '@/seo/jsonld'
import { pageMetadata } from '@/seo/metadata'
import { pickParams, toSearchParams, type RawSearchParams } from '@/lib/searchParams'
import { catalogCopy, loadCatalog } from '../elanlar/catalog'

/** Query parameters a category page honours: presentation and pagination only (filters belong to /elanlar). */
const PAGE_PARAMS = ['siralama', 'gorunus', 'sehife']

export interface CategoryRouteProps {
  params: Promise<{ kateqoriya: string; seher?: string }>
  searchParams: Promise<RawSearchParams>
}

async function load({ params, searchParams }: CategoryRouteProps) {
  const { kateqoriya, seher } = await params
  const repo = getRepository()
  const category = await repo.getProductCategory(kateqoriya)
  const city = seher === undefined ? undefined : await repo.getCity(seher)
  if (!category || (seher !== undefined && !city)) return undefined

  const url = pickParams(toSearchParams(await searchParams), PAGE_PARAMS)
  const state = new URLSearchParams({ kateqoriya: category.id, ...(city ? { seher: city.id } : {}) })
  for (const key of ['siralama', 'gorunus']) {
    const value = url.get(key)
    if (value) state.set(key, value)
  }
  const data = await loadCatalog(state.toString(), url.get('sehife'))
  return { ...data, category, city, stateQuery: state.toString(), urlQuery: url.toString(), basePath: categoryPath(category.id, city?.id) }
}

export async function categoryMetadata(props: CategoryRouteProps): Promise<Metadata> {
  const data = await load(props)
  if (!data || data.outOfRange) return { title: 'Səhifə tapılmadı', robots: { index: false, follow: false } }
  const rule = categoryPageRule(data.category.id, data.city?.id, data.result.total, data.requestedPage)
  const { title, description } = catalogCopy(data.state, data.result.total, data.requestedPage, { cityPage: Boolean(data.city) })
  return pageMetadata({ title, description, canonical: rule.canonical, index: rule.index, follow: rule.follow })
}

/**
 * /kateqoriyalar/[kateqoriya] and /kateqoriyalar/[kateqoriya]/[seher]: the catalogue for one category (and city)
 * on a clean URL. Same UI as /elanlar?kateqoriya=…; changing a filter continues on /elanlar.
 */
export async function CategoryRoute(props: CategoryRouteProps) {
  const data = await load(props)
  if (!data || data.outOfRange) notFound()
  const crumbs = searchCrumbs(data.state, { cityPage: Boolean(data.city) })
  return (
    <>
      <JsonLd data={crumbsJsonLd(crumbs)} />
      <SearchPage
        state={data.state}
        view={data.view}
        result={data.result}
        stateQuery={data.stateQuery}
        basePath={data.basePath}
        urlQuery={data.urlQuery}
        crumbs={crumbs}
      />
    </>
  )
}
