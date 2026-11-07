import { ClientGate } from '@/components/layout/ClientGate'
import { SessionFallback } from '@/components/layout/SessionFallback'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { SavedSearchesSkeleton } from '@/features/account/AccountSkeletons'
import { privateMetadata } from '@/seo/metadata'
import SavedSearchesPage from '@/views/account/SavedSearchesPage'

export const metadata = privateMetadata('Axtarışlarım')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate fallback={<SessionFallback guest={<SignInPrompt next="/kabinet/axtarislar" />} user={<SavedSearchesSkeleton />} />}>
      <SavedSearchesPage />
    </ClientGate>
  )
}
