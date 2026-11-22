import type { Metadata } from 'next'
import { toSearchParams, type RawSearchParams } from '@/lib/searchParams'
import { getRepository } from '@/services/repository'
import { parsePage } from '@/seo/catalog'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd } from '@/seo/jsonld'
import { pageMetadata } from '@/seo/metadata'
import { loadSellerDirectory } from '@/features/seller/directory'
import SellersDirectoryPage, { parseDirectoryQuery } from '@/views/SellersDirectoryPage'

type Props = { searchParams: Promise<RawSearchParams> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { kind, city } = parseDirectoryQuery(toSearchParams(await searchParams))
  // Filtered variants are not indexed; the plain directory is.
  return pageMetadata({
    title: 'Satıcılar — tingçiliklər, bağ mərkəzləri, landşaft şirkətləri',
    description: 'Azərbaycanda tingçilik təsərrüfatları, bağ mərkəzləri və landşaft şirkətləri: profil, iş saatları, ünvan və elanlar.',
    canonical: kind || city ? undefined : '/saticilar',
    index: !kind && !city,
  })
}

/** /saticilar — directory of the businesses on GreenStore, a page at a time, with the count of every kind tab. */
export default async function Page({ searchParams }: Props) {
  const params = toSearchParams(await searchParams)
  const { kind, city } = parseDirectoryQuery(params)
  const { result, counts } = await loadSellerDirectory(getRepository(), { kind, city, page: parsePage(params.get('sehife')) })
  return (
    <>
      <JsonLd data={crumbsJsonLd([{ label: 'Ana səhifə', to: '/' }, { label: 'Satıcılar' }])} />
      <SellersDirectoryPage result={result} counts={counts} kind={kind} city={city} />
    </>
  )
}
