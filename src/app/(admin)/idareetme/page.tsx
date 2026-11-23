import { connection } from 'next/server'
import { ClientGate } from '@/components/layout/ClientGate'
import { PageSkeleton } from '@/views/ListingSkeleton'
import { privateMetadata } from '@/seo/metadata'
import { dataSource } from '@/seo/env'
import ApiModerationPage from '@/views/admin/ApiModerationPage'
import ModerationPage from '@/views/admin/ModerationPage'

export const metadata = privateMetadata('İdarəetmə · Moderasiya')

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * DATA_SOURCE=api: the numbers of every section and the API's queue, rendered per request for the signed-in staff
 * (ApiModerationPage). DATA_SOURCE=mock: the Figma queue in the browser, driven by browser storage (rendered after
 * hydration, see ClientGate).
 */
export default async function Page({ searchParams }: Props) {
  if (dataSource() === 'api') {
    await connection()
    return <ApiModerationPage searchParams={searchParams} withOverview />
  }
  return (
    <ClientGate fallback={<PageSkeleton />}>
      <ModerationPage />
    </ClientGate>
  )
}
