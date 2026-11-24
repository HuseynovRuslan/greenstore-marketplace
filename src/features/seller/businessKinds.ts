import { businessKindLabels } from '@/data/user'
import type { BusinessKind } from '@/types'

/** The three kinds, in the order a business's kinds are kept and shown in (the API keeps the same order). */
export const BUSINESS_KINDS: readonly BusinessKind[] = ['nursery', 'garden-centre', 'landscaping']

/** Each known kind once, in that order; anything else is dropped. */
export function orderedKinds(kinds: readonly unknown[] | undefined): BusinessKind[] {
  return BUSINESS_KINDS.filter((kind) => kinds?.includes(kind))
}

/** «Tingçilik təsərrüfatı · Bağ mərkəzi»: a business's kinds as the site names them. */
export function businessKindsLabel(kinds: readonly BusinessKind[] | undefined): string {
  return orderedKinds(kinds)
    .map((kind) => businessKindLabels[kind])
    .join(' · ')
}

/** Adds or removes one kind (the checkboxes of «Biznesin növü»). */
export function toggleKind(kinds: readonly BusinessKind[], kind: BusinessKind): BusinessKind[] {
  return kinds.includes(kind) ? kinds.filter((k) => k !== kind) : orderedKinds([...kinds, kind])
}
