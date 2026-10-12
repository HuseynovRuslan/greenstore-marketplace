import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ButtonLink } from '@/components/ui/Button'

/** Shown instead of the cabinet pages when there is no session (EmptyState pattern from "Boş vəziyyətlər"). */
export function SignInPrompt({ next }: { next: string }) {
  const query = `?next=${encodeURIComponent(next)}`
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<UserRound aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Şəxsi kabinetə daxil olun"
        description="Elanlarınızı və profil məlumatlarınızı idarə etmək üçün hesabınıza daxil olun."
        action={
          <>
            <ButtonLink href={`/daxil-ol${query}`} fullWidth>
              Daxil ol
            </ButtonLink>
            <p className="w-full text-sm leading-[1.5] text-ink">
              Hesabınız yoxdur?{' '}
              <Link href={`/qeydiyyat${query}`} className="hover:text-olive hover:underline">
                Qeydiyyatdan keçin →
              </Link>
            </p>
          </>
        }
      />
    </div>
  )
}
