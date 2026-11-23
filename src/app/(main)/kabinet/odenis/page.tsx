import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { privateMetadata } from '@/seo/metadata'
import { dataSource } from '@/seo/env'
import PaymentResultPage from '@/views/account/PaymentResultPage'

export const metadata = privateMetadata('Ödənişin nəticəsi')

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * DATA_SOURCE=api: the page the payment provider brings the owner back to after «Ödə» on /reklam
 * (`?order=<id>`, backend-contract.md 5.1), rendered per request for the signed-in account. The demo
 * (DATA_SOURCE=mock) pays in the browser's dialog, so it has no such page.
 */
export default async function Page({ searchParams }: Props) {
  if (dataSource() !== 'api') notFound()
  await connection()
  return <PaymentResultPage searchParams={searchParams} />
}
