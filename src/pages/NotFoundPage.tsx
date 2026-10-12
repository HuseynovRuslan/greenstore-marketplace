import { Search } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ButtonLink } from '@/components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Səhifə tapılmadı"
        description="Axtardığınız səhifə silinib və ya ünvan səhvdir."
        action={
          <ButtonLink to="/" fullWidth>
            Ana səhifəyə qayıt
          </ButtonLink>
        }
      />
    </div>
  )
}
