import type { Metadata } from 'next'
import HomePage from '@/views/HomePage'
import { loadHeroCounts } from '@/features/home/heroCounts'
import { getRepository } from '@/services/repository'
import { JsonLd } from '@/seo/StructuredData'
import { websiteJsonLd } from '@/seo/jsonld'
import { pageMetadata } from '@/seo/metadata'
import { SITE_DESCRIPTION, SITE_TITLE } from '@/seo/site'

export const metadata: Metadata = {
  ...pageMetadata({ title: SITE_TITLE, description: SITE_DESCRIPTION, canonical: '/' }),
  // The home title is the full site title, not "… — GreenStore".
  title: { absolute: SITE_TITLE },
}

export default async function Page() {
  const repo = getRepository()
  const [content, hero] = await Promise.all([repo.getHomeContent(), loadHeroCounts(repo)])
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <HomePage content={content} hero={hero} />
    </>
  )
}
