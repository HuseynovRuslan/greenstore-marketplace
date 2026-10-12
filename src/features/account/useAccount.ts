import { useMemo } from 'react'
import { useSession } from '@/app/store'
import { currentUser, type AccountProfile } from '@/data/user'

/**
 * Session user with the profile-only fields (company, city, notifications…).
 * Sessions saved before these fields existed fall back to the demo account's values.
 */
export function useAccount() {
  const session = useSession()
  const account = useMemo<AccountProfile | null>(() => {
    if (!session.user) return null
    const defaults = session.user.id === currentUser.id ? currentUser : {}
    return { ...defaults, ...session.user } as AccountProfile
  }, [session.user])

  const updateAccount = (patch: Partial<AccountProfile>) => session.updateProfile(patch)

  return { ...session, account, updateAccount }
}

/** "Elvin Əliyev" → "Elvin" */
export function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}
