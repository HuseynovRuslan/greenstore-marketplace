import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { privateMetadata } from '@/seo/metadata'
import { dataSource } from '@/seo/env'
import IncomingRequestsPage from '@/views/account/IncomingRequestsPage'

export const metadata = privateMetadata('Gələn sorğular')

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * DATA_SOURCE=api: «Gələn sorğular», the provider's «Usta çağır» requests, rendered per request for the signed-in
 * account. The demo (DATA_SOURCE=mock) stores no requests, so it has no such page.
 */
export default async function Page({ searchParams }: Props) {
  if (dataSource() !== 'api') notFound()
  await connection()
  return <IncomingRequestsPage searchParams={searchParams} />
}
