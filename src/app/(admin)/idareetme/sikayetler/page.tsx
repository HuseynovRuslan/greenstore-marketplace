import { privateMetadata } from '@/seo/metadata'
import ComplaintsPage from '@/views/admin/ComplaintsPage'

export const metadata = privateMetadata('İdarəetmə · Şikayətlər')

export default function Page() {
  return <ComplaintsPage />
}
