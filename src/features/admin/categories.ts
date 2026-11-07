import { categories } from '@/data/categories'
import { categoryAdminFields, type CategoryFilter } from '@/data/admin'
import { normalizeSearch } from '@/lib/format'
import type { IconName } from '@/types'

/** Category as edited in "Kateqoriya idarəetməsi" (`@/data/categories` + admin-only fields). */
export interface AdminCategory {
  id: string
  name: string
  icon: IconName
  subcategories: string[]
  filters: CategoryFilter[]
  order: number
  active: boolean
  formOrder?: string[]
}

export function initialAdminCategories(): AdminCategory[] {
  return categories.map((c, i) => {
    const admin = categoryAdminFields[c.id]
    return {
      id: c.id,
      name: c.name,
      icon: c.icon,
      subcategories: admin?.subcategories ?? [],
      filters: admin?.filters ?? [],
      order: admin?.order ?? i + 1,
      active: admin?.active ?? true,
      formOrder: admin?.formOrder,
    }
  })
}

/** Rows in "Görünmə sırası" order (ties keep their current position). */
export function sortByOrder(rows: AdminCategory[]): AdminCategory[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.order - b.row.order || a.index - b.index)
    .map(({ row }) => row)
}

export function matchesCategory(row: AdminCategory, query: string): boolean {
  const q = normalizeSearch(query)
  if (!q) return true
  return [row.name, ...row.subcategories].some((text) => normalizeSearch(text).includes(q))
}

/** Filter checkboxes in the order the edit panel shows them. */
export function formFilters(row: Pick<AdminCategory, 'filters' | 'formOrder'>): CategoryFilter[] {
  if (!row.formOrder) return row.filters
  const rank = (f: CategoryFilter) => {
    const i = row.formOrder!.indexOf(f.id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...row.filters].sort((a, b) => rank(a) - rank(b))
}

/** "Dekorativ ağaclar · Meyvə ağacları · İynəyarpaqlılar" ⇄ list (also accepts commas and new lines). */
export const joinSubcategories = (list: string[]) => list.join(' · ')
export const splitSubcategories = (text: string) =>
  text
    .split(/[·,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

export interface CategoryDraft {
  name: string
  subcategories: string
  order: string
  icon: IconName
  active: boolean
  filters: Record<string, boolean>
}

export function draftFrom(row: AdminCategory): CategoryDraft {
  return {
    name: row.name,
    subcategories: joinSubcategories(row.subcategories),
    order: String(row.order),
    icon: row.icon,
    active: row.active,
    filters: Object.fromEntries(row.filters.map((f) => [f.id, f.enabled])),
  }
}

export function emptyDraft(rows: AdminCategory[]): CategoryDraft {
  return {
    name: '',
    subcategories: '',
    order: String(rows.reduce((max, r) => Math.max(max, r.order), 0) + 1),
    icon: 'sprout',
    active: true,
    filters: {},
  }
}

export interface DraftErrors {
  name?: string
  order?: string
}

export function validateDraft(draft: CategoryDraft, rows: AdminCategory[], editingId: string | null): DraftErrors {
  const errors: DraftErrors = {}
  const name = draft.name.trim()
  if (!name) errors.name = 'Kateqoriya adını daxil edin.'
  else if (rows.some((r) => r.id !== editingId && normalizeSearch(r.name) === normalizeSearch(name)))
    errors.name = 'Bu adda kateqoriya artıq mövcuddur.'
  const order = draft.order.trim()
  if (!order) errors.order = 'Görünmə sırasını daxil edin.'
  else if (!/^\d+$/.test(order) || Number(order) < 1) errors.order = 'Görünmə sırası müsbət tam ədəd olmalıdır.'
  return errors
}

/** Turns a free-form name into an ASCII id ("Bağ dekoru" → "bag-dekoru"). */
export function slugify(name: string): string {
  return (
    normalizeSearch(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'kateqoriya'
  )
}
