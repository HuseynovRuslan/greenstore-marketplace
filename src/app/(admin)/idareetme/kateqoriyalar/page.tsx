import { privateMetadata } from '@/seo/metadata'
import CategoriesAdminPage from '@/views/admin/CategoriesAdminPage'

export const metadata = privateMetadata('İdarəetmə · Kateqoriyalar')

export default function Page() {
  return <CategoriesAdminPage />
}
