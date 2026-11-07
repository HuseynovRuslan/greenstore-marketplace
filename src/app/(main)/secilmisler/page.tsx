import { ClientGate } from '@/components/layout/ClientGate'
import { FavoritesSkeleton } from '@/features/account/AccountSkeletons'
import { privateMetadata } from '@/seo/metadata'
import FavoritesPage from '@/views/account/FavoritesPage'

export const metadata = privateMetadata('Seçilmişlər')

/** Private page driven by browser storage: rendered after hydration (see ClientGate). */
export default function Page() {
  return (
    <ClientGate fallback={<FavoritesSkeleton />}>
      <FavoritesPage />
    </ClientGate>
  )
}
