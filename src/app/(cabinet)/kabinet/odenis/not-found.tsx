import { ReceiptText } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { privateMetadata } from '@/seo/metadata'

export const metadata = privateMetadata('Sifariş tapılmadı')

/** HTTP 404 for a return address that names none of the session's own orders (unknown, or another account's). */
export default function OrderNotFound() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<ReceiptText aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Sifariş tapılmadı"
        description="Bu sifariş sizin hesabınıza aid deyil və ya ünvan səhvdir. Reklamlarınızı «Elanlarım»da görə bilərsiniz."
        action={
          <ButtonLink href="/kabinet" fullWidth>
            Elanlarım
          </ButtonLink>
        }
      />
    </div>
  )
}
