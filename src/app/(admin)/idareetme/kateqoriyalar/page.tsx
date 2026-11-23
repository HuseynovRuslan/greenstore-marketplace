import { connection } from 'next/server'
import { privateMetadata } from '@/seo/metadata'
import { dataSource } from '@/seo/env'
import ApiCategoriesPage from '@/views/admin/ApiCategoriesPage'
import CategoriesAdminPage from '@/views/admin/CategoriesAdminPage'

export const metadata = privateMetadata('İdarəetmə · Kateqoriyalar')

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * DATA_SOURCE=api: the API's categories, rendered per request for a signed-in admin (ApiCategoriesPage).
 * DATA_SOURCE=mock: the Figma categories in the browser, as before.
 */
export default async function Page({ searchParams }: Props) {
  if (dataSource() === 'api') {
    await connection()
    return <ApiCategoriesPage searchParams={searchParams} />
  }
  return <CategoriesAdminPage />
}
