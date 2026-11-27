import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import type { UserProfile } from '@/types'
import { isStaff } from './roles'

/** Who may open a staff page: moderators and admins, or admins alone (categories). */
export type StaffLevel = 'staff' | 'admin'

export { isStaff }

/** May `user` open a page of `level`? (The API checks it again: 403 otherwise.) */
export const mayOpen = (user: Pick<UserProfile, 'role'>, level: StaffLevel) => (level === 'admin' ? user.role === 'admin' : isStaff(user))

/** A staff page for an account without the role (the API would answer 403 anyway). */
export function NotStaff({ level = 'staff' }: { level?: StaffLevel }) {
  const admin = level === 'admin'
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<ShieldAlert aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title={admin ? 'Bu bölmə adminlər üçündür' : 'Bu bölmə moderatorlar üçündür'}
        description={
          admin
            ? 'Kateqoriyaları yalnız admin dəyişə bilər. Moderasiya və şikayətlər bölmələri moderatorlara da açıqdır.'
            : 'Hesabınızın moderasiyaya icazəsi yoxdur. Elanlarınızı şəxsi kabinetdə idarə edə bilərsiniz.'
        }
        action={
          <ButtonLink href={admin ? '/idareetme' : '/kabinet'} fullWidth>
            {admin ? 'İdarəetməyə qayıt' : 'Şəxsi kabinet'}
          </ButtonLink>
        }
      />
    </div>
  )
}

/**
 * What a staff page shows instead of itself: «daxil olun» without a session (back to `next` after it), «Bu bölmə …
 * üçündür» without the role; `undefined` when `user` may open it.
 */
export function staffGate(user: UserProfile | undefined, next: string, level: StaffLevel = 'staff'): ReactNode | undefined {
  if (!user) return <SignInPrompt next={next} />
  if (!mayOpen(user, level)) return <NotStaff level={level} />
  return undefined
}
