import { ClientGate } from '@/components/layout/ClientGate'
import { privateMetadata } from '@/seo/metadata'
import DashboardPage from '@/views/account/DashboardPage'

export const metadata = privateMetadata('Şəxsi kabinet')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate>
      <DashboardPage />
    </ClientGate>
  )
}
