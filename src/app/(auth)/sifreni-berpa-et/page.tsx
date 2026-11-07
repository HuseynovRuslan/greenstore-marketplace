import { privateMetadata } from '@/seo/metadata'
import ResetPasswordPage from '@/views/ResetPasswordPage'

export const metadata = privateMetadata('Şifrəni bərpa edin')

export default function Page() {
  return <ResetPasswordPage />
}
