import { ClientGate } from '@/components/layout/ClientGate'
import { privateMetadata } from '@/seo/metadata'
import ProfilePage from '@/views/account/ProfilePage'

export const metadata = privateMetadata('Profil məlumatları')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate>
      <ProfilePage />
    </ClientGate>
  )
}
