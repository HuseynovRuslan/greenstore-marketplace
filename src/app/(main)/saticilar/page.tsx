import type { Metadata } from 'next'
import { toSearchParams, type RawSearchParams } from '@/lib/searchParams'
import { getRepository } from '@/services/repository'
import { JsonLd } from '@/seo/StructuredData'
import { crumbsJsonLd } from '@/seo/jsonld'
import { pageMetadata } from '@/seo/metadata'
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

/** /saticilar — directory of the businesses on GreenStore. */
export default async function Page({ searchParams }: Props) {
  const { kind, city } = parseDirectoryQuery(toSearchParams(await searchParams))
  const sellers = (await getRepository().listSellers()).filter((s) => s.type === 'business')
  return (
    <>
      <JsonLd data={crumbsJsonLd([{ label: 'Ana səhifə', to: '/' }, { label: 'Satıcılar' }])} />
      <SellersDirectoryPage sellers={sellers} kind={kind} city={city} />
    </>
  )
}
