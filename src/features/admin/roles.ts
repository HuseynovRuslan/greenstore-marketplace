import type { UserProfile } from '@/types'

/**
 * Staff (moderators and admins) may open /idareetme. Kept apart from StaffGate so the header's menus can ask without
 * loading the staff pages' components.
 */
export const isStaff = (user: Pick<UserProfile, 'role'> | null | undefined) => user?.role === 'moderator' || user?.role === 'admin'
