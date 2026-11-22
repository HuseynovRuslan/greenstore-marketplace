import { connection } from 'next/server'
import { privateMetadata } from '@/seo/metadata'
import { dataSource } from '@/seo/env'
import ApiComplaintsPage from '@/views/admin/ApiComplaintsPage'
import ComplaintsPage from '@/views/admin/ComplaintsPage'

export const metadata = privateMetadata('İdarəetmə · Şikayətlər')

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * DATA_SOURCE=api: the API's reports, rendered per request for the signed-in staff (ApiComplaintsPage).
 * DATA_SOURCE=mock: the Figma complaints in the browser, as before.
 */
export default async function Page({ searchParams }: Props) {
  if (dataSource() === 'api') {
    await connection()
    return <ApiComplaintsPage searchParams={searchParams} />
  }
  return <ComplaintsPage />
}
