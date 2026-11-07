import { ClientGate } from '@/components/layout/ClientGate'
import { SessionFallback } from '@/components/layout/SessionFallback'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { DashboardSkeleton } from '@/features/account/AccountSkeletons'
import { privateMetadata } from '@/seo/metadata'
import DashboardPage from '@/views/account/DashboardPage'

export const metadata = privateMetadata('Şəxsi kabinet')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate fallback={<SessionFallback guest={<SignInPrompt next="/kabinet" />} user={<DashboardSkeleton />} />}>
      <DashboardPage />
    </ClientGate>
  )
}
