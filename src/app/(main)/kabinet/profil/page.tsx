import { ClientGate } from '@/components/layout/ClientGate'
import { SessionFallback } from '@/components/layout/SessionFallback'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { ProfileSkeleton } from '@/features/account/AccountSkeletons'
import { privateMetadata } from '@/seo/metadata'
import ProfilePage from '@/views/account/ProfilePage'

export const metadata = privateMetadata('Profil məlumatları')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate fallback={<SessionFallback guest={<SignInPrompt next="/kabinet/profil" />} user={<ProfileSkeleton />} />}>
      <ProfilePage />
    </ClientGate>
  )
}
