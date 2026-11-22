import { categoryIconLabels } from '@/data/admin'
import { normalizeSearch } from '@/lib/format'
import type { AdminCategory, AdminCategoryInput, AdminCategoryPatch, CategoryFilterSetting, CategoryForm, CategoryKind, IconName, LocalizedText } from '@/types'

/*
 * DATA_SOURCE=api: /idareetme/kateqoriyalar over the API's categories (backend-contract.md 3.5, admins only). Names
 * are written in all three languages (`LocalizedText`); a category's form decides its filters; a sub-category takes
 * its parent's kind and has no form, icon or filters. These pure helpers keep the page's state in its address
 * (?q=…&item=<id>|new&parent=<id>&saved=…), turn the edit form into the API's bodies, and word the API's field errors.
 * The same checks run in the browser and again in the Server Action.
 */

export const NAME_MAX = 60
export const DESCRIPTION_MAX = 200
export const SORT_MAX = 100_000

/** The filters a category of each form can have, in the catalogue's order (the API's `CategoryFilters.For`). */
export const formFilterIds: Record<CategoryForm, string[]> = {
  plant: ['species', 'height', 'age', 'rootSystem'],
  service: ['serviceType', 'area', 'priceType'],
  pack: [],
  goods: [],
  grass: [],
}

export const filterLabels: Record<string, string> = {
  species: 'Növ',
  height: 'Hündürlük',
  age: 'Yaş',
  rootSystem: 'Kök sistemi',
  serviceType: 'Xidmət növü',
  area: 'Ərazi',
  priceType: 'Qiymət forması',
}

/** «Elan yerləşdir»'s attribute sets (features/posting/attributes.ts). */
export const formLabels: Record<CategoryForm, string> = {
  plant: 'Bitki: hündürlük, yaş, kök sistemi',
  pack: 'Qablaşdırılan məhsul: torpaq, gübrə',
  goods: 'Avadanlıq və alət',
  grass: 'Qazon və toxum',
  service: 'Xidmət',
}

export const kindLabels: Record<CategoryKind, string> = { product: 'Məhsul', service: 'Xidmət' }

const FORMS = Object.keys(formLabels) as CategoryForm[]
const KINDS: CategoryKind[] = ['product', 'service']
const ICONS = Object.keys(categoryIconLabels) as IconName[]
const ID_RE = /^[a-z0-9-]{1,80}$/
const VERSION_RE = /^[\x21-\x7e]{1,40}$/

/** Services are posted with the service form; products with one of the others. */
export const formsFor = (kind: CategoryKind): CategoryForm[] => FORMS.filter((f) => (kind === 'service') === (f === 'service'))

/* ---------- The page's address ---------- */

export interface CategoryPageState {
  q: string
  /** The category or sub-category in the edit panel; `new` for a new one */
  item?: string
  /** A new one's category: then it is a sub-category */
  parent?: string
  /** The notice after a save */
  saved?: 'created' | 'updated'
}

type Params = Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export function readCategoryParams(params: Params): CategoryPageState {
  const item = one(params.item)
  const parent = one(params.parent)
  const saved = one(params.saved)
  return {
    q: (one(params.q) ?? '').trim().slice(0, 100),
    ...(item && (item === 'new' || ID_RE.test(item)) ? { item } : {}),
    ...(item === 'new' && parent && ID_RE.test(parent) ? { parent } : {}),
    ...(saved === 'created' || saved === 'updated' ? { saved } : {}),
  }
}

/** The page's address with some of its state changed; the save notice is never carried along. */
export function categoryHref(state: CategoryPageState, patch: Partial<Omit<CategoryPageState, 'saved'>> = {}, saved?: CategoryPageState['saved']): string {
  const next = { ...state, ...patch }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.item) params.set('item', next.item)
  if (next.item === 'new' && next.parent) params.set('parent', next.parent)
  if (saved) params.set('saved', saved)
  const query = params.toString()
  return query ? `/idareetme/kateqoriyalar?${query}` : '/idareetme/kateqoriyalar'
}

/* ---------- The list ---------- */

const namesOf = (c: Pick<AdminCategory, 'names'>) => [c.names.az, c.names.ru, c.names.en].filter((n): n is string => Boolean(n))

/** A search over the names in every language, sub-categories' too. */
export function matchesAdminCategory(category: AdminCategory, query: string): boolean {
  const q = normalizeSearch(query)
  if (!q) return true
  return [category, ...(category.subcategories ?? [])].some((c) => namesOf(c).some((name) => normalizeSearch(name).includes(q)))
}

/** The category or sub-category an id names. */
export function findAdminCategory(list: AdminCategory[], id: string | undefined): AdminCategory | undefined {
  if (!id) return undefined
  for (const category of list) {
    if (category.id === id) return category
    const sub = category.subcategories?.find((s) => s.id === id)
    if (sub) return sub
  }
  return undefined
}

/** «Filtrlər: Hündürlük · Kök sistemi»: the filters that are on. */
export const enabledFilterNames = (category: Pick<AdminCategory, 'filters'>) =>
  category.filters.filter((f) => f.enabled).map((f) => filterLabels[f.id] ?? f.id)

/** The newest change of any row: «Son yenilənmə». */
export function lastUpdated(list: AdminCategory[]): string | undefined {
  const all = list.flatMap((c) => [c, ...(c.subcategories ?? [])]).map((c) => c.updatedAt)
  return all.length ? all.reduce((a, b) => (a > b ? a : b)) : undefined
}

/* ---------- The edit form ---------- */

export interface CategoryEditorDraft {
  names: { az: string; ru: string; en: string }
  descriptions: { az: string; ru: string; en: string }
  /** A new category only */
  kind: CategoryKind
  /** A new category only */
  form: CategoryForm | ''
  icon: IconName | ''
  sortOrder: string
  isActive: boolean
  /** Filter id → on; the form's filters only */
  filters: Record<string, boolean>
}

const texts = (value: LocalizedText | undefined) => ({ az: value?.az ?? '', ru: value?.ru ?? '', en: value?.en ?? '' })

/** The form for an existing row, or for a new category (`parent` set: a new sub-category of it). */
export function draftOf(category: AdminCategory | undefined, parent?: AdminCategory): CategoryEditorDraft {
  if (category) {
    const ids = category.form ? formFilterIds[category.form] : []
    return {
      names: texts(category.names),
      descriptions: texts(category.descriptions),
      kind: category.kind,
      form: category.form ?? '',
      icon: category.icon ?? '',
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
      filters: Object.fromEntries(ids.map((id) => [id, category.filters.find((f) => f.id === id)?.enabled ?? false])),
    }
  }
  return {
    names: { az: '', ru: '', en: '' },
    descriptions: { az: '', ru: '', en: '' },
    kind: parent?.kind ?? 'product',
    form: parent ? '' : 'plant',
    icon: parent ? '' : 'sprout',
    sortOrder: '',
    isActive: true,
    filters: {},
  }
}

export type CategoryFieldErrors = Partial<Record<string, string>>

const FIELD_MESSAGES: Record<string, Record<string, string>> = {
  'names.az': { required: 'Azərbaycanca adı yazın.', 'too-long': `Ad ən çox ${NAME_MAX} simvol olsun.`, taken: 'Bu adda kateqoriya artıq var.' },
  'names.ru': { 'too-long': `Ad ən çox ${NAME_MAX} simvol olsun.` },
  'names.en': { 'too-long': `Ad ən çox ${NAME_MAX} simvol olsun.` },
  'descriptions.az': { required: 'Əvvəlcə Azərbaycanca təsviri yazın.', 'too-long': `Təsvir ən çox ${DESCRIPTION_MAX} simvol olsun.` },
  'descriptions.ru': { 'too-long': `Təsvir ən çox ${DESCRIPTION_MAX} simvol olsun.` },
  'descriptions.en': { 'too-long': `Təsvir ən çox ${DESCRIPTION_MAX} simvol olsun.` },
  icon: { '*': 'Kateqoriya işarəsini seçin.' },
  form: { '*': 'Elan formasını seçin.' },
  kind: { '*': 'Növü seçin.' },
  sortOrder: { '*': `Görünmə sırası 0 ilə ${SORT_MAX.toLocaleString('az')} arasında tam ədəd olsun.` },
  filters: { '*': 'Bu formanın belə filtri yoxdur.' },
  id: { taken: 'Bu ünvan artıq başqa kateqoriyanındır.', '*': 'Kateqoriyanın ünvanı düzgün deyil.' },
  parentId: { '*': 'Əsas kateqoriya tapılmadı.' },
  version: { '*': 'Səhifəni yeniləyin.' },
}

/** The API's field errors (`{ 'names.az': ['taken'] }`) in the admin's words. */
export function categoryFieldMessages(errors: Record<string, string[]>): CategoryFieldErrors {
  const result: CategoryFieldErrors = {}
  for (const [field, codes] of Object.entries(errors)) {
    const messages = FIELD_MESSAGES[field]
    const code = codes[0]
    if (messages && code) result[field] = messages[code] ?? messages['*'] ?? 'Dəyəri yoxlayın.'
  }
  return result
}

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** `LocalizedText` from the three boxes; undefined when all are empty. */
function localized(value: { az?: unknown; ru?: unknown; en?: unknown } | null | undefined): LocalizedText | undefined {
  const az = trimmed(value?.az)
  const ru = trimmed(value?.ru)
  const en = trimmed(value?.en)
  if (!az && !ru && !en) return undefined
  return { az, ...(ru ? { ru } : {}), ...(en ? { en } : {}) }
}

function checkTexts(prefix: 'names' | 'descriptions', value: LocalizedText | undefined, max: number, required: boolean, errors: CategoryFieldErrors) {
  const code = (field: string, error: string) => (errors[`${prefix}.${field}`] = FIELD_MESSAGES[`${prefix}.${field}`][error])
  if (!value) {
    if (required) code('az', 'required')
    return
  }
  if (!value.az) code('az', 'required')
  for (const lang of ['az', 'ru', 'en'] as const) if ((value[lang]?.length ?? 0) > max) code(lang, 'too-long')
}

function checkSortOrder(value: unknown, errors: CategoryFieldErrors): number | undefined {
  if (value === undefined || value === '') return undefined
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 0 || n > SORT_MAX) errors.sortOrder = FIELD_MESSAGES.sortOrder['*']
  return n
}

function checkFilters(value: unknown, form: CategoryForm | undefined, errors: CategoryFieldErrors): CategoryFilterSetting[] | undefined {
  if (value === undefined) return undefined
  const allowed = form ? formFilterIds[form] : []
  const list = Array.isArray(value) ? value : []
  const clean = list.map((f) => ({ id: trimmed(f?.id), enabled: f?.enabled === true }))
  if (!Array.isArray(value) || clean.some((f) => !allowed.includes(f.id)) || new Set(clean.map((f) => f.id)).size !== clean.length) {
    errors.filters = FIELD_MESSAGES.filters['*']
  }
  return clean
}

/** A new category as the API takes it, or the field errors. Re-checked in the Server Action (anything may arrive). */
export function checkCategoryInput(input: AdminCategoryInput): { ok: true; value: AdminCategoryInput } | { ok: false; fields: CategoryFieldErrors } {
  const errors: CategoryFieldErrors = {}
  const parentId = trimmed(input?.parentId) || undefined
  if (parentId && !ID_RE.test(parentId)) errors.parentId = FIELD_MESSAGES.parentId['*']
  const sub = Boolean(parentId)
  const kind = input?.kind
  if (!sub && !KINDS.includes(kind as CategoryKind)) errors.kind = FIELD_MESSAGES.kind['*']
  const form = sub ? undefined : input?.form
  if (!sub && (!form || !FORMS.includes(form) || (kind && !formsFor(kind).includes(form)))) errors.form = FIELD_MESSAGES.form['*']
  const icon = sub ? undefined : input?.icon
  if (!sub && (!icon || !ICONS.includes(icon))) errors.icon = FIELD_MESSAGES.icon['*']
  const names = localized(input?.names)
  checkTexts('names', names, NAME_MAX, true, errors)
  const descriptions = localized(input?.descriptions)
  checkTexts('descriptions', descriptions, DESCRIPTION_MAX, false, errors)
  const sortOrder = checkSortOrder(input?.sortOrder, errors)
  const filters = sub ? undefined : checkFilters(input?.filters, form, errors)
  if (Object.keys(errors).length || !names) return { ok: false, fields: errors }
  return {
    ok: true,
    value: {
      ...(parentId ? { parentId } : { kind, form, icon }),
      names,
      ...(descriptions ? { descriptions } : {}),
      ...(filters?.length ? { filters } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
      isActive: input.isActive !== false,
    },
  }
}

/** A change as the API takes it (only known fields), or the field errors. The form is the row's: filters are checked by the API. */
export function checkCategoryPatch(patch: AdminCategoryPatch): { ok: true; value: AdminCategoryPatch } | { ok: false; fields: CategoryFieldErrors } {
  const errors: CategoryFieldErrors = {}
  const value: AdminCategoryPatch = {}
  if (patch?.names !== undefined) {
    const names = localized(patch.names)
    checkTexts('names', names, NAME_MAX, true, errors)
    if (names) value.names = names
  }
  if (patch?.descriptions !== undefined) {
    const descriptions = patch.descriptions === null ? undefined : localized(patch.descriptions)
    checkTexts('descriptions', descriptions, DESCRIPTION_MAX, false, errors)
    value.descriptions = descriptions ?? null
  }
  if (patch?.icon !== undefined) {
    if (!ICONS.includes(patch.icon)) errors.icon = FIELD_MESSAGES.icon['*']
    value.icon = patch.icon
  }
  if (patch?.filters !== undefined) {
    // Any of the forms' filters here; the API knows the row's form and refuses one it has not.
    const list = Array.isArray(patch.filters) ? patch.filters : []
    const known = new Set(Object.values(formFilterIds).flat())
    const clean = list.map((f) => ({ id: trimmed(f?.id), enabled: f?.enabled === true }))
    if (!Array.isArray(patch.filters) || clean.some((f) => !known.has(f.id)) || new Set(clean.map((f) => f.id)).size !== clean.length) errors.filters = FIELD_MESSAGES.filters['*']
    value.filters = clean
  }
  if (patch?.sortOrder !== undefined) {
    const sortOrder = checkSortOrder(patch.sortOrder, errors)
    if (sortOrder === undefined) errors.sortOrder = FIELD_MESSAGES.sortOrder['*']
    else value.sortOrder = sortOrder
  }
  if (patch?.isActive !== undefined) {
    if (typeof patch.isActive !== 'boolean') errors.version = FIELD_MESSAGES.version['*']
    else value.isActive = patch.isActive
  }
  if (patch?.version !== undefined) {
    if (typeof patch.version !== 'string' || !VERSION_RE.test(patch.version)) errors.version = FIELD_MESSAGES.version['*']
    else value.version = patch.version
  }
  if (Object.keys(errors).length) return { ok: false, fields: errors }
  return { ok: true, value }
}

const sameTexts = (a: { az: string; ru: string; en: string }, b: { az: string; ru: string; en: string }) =>
  a.az.trim() === b.az.trim() && a.ru.trim() === b.ru.trim() && a.en.trim() === b.en.trim()

/** The new category the form describes (`parent`: a sub-category of it). */
export function toCategoryInput(draft: CategoryEditorDraft, parent?: AdminCategory): AdminCategoryInput {
  const sortOrder = draft.sortOrder.trim()
  const form = draft.form || undefined
  return {
    ...(parent
      ? { parentId: parent.id }
      : {
          kind: draft.kind,
          form,
          icon: draft.icon || undefined,
          filters: (form ? formFilterIds[form] : []).map((id) => ({ id, enabled: draft.filters[id] ?? false })),
        }),
    names: localized(draft.names) ?? { az: '' },
    ...(localized(draft.descriptions) ? { descriptions: localized(draft.descriptions) } : {}),
    ...(sortOrder ? { sortOrder: Number(sortOrder) } : {}),
    isActive: draft.isActive,
  }
}

/** What changed between the row and the form, with the row's version; `undefined` when nothing did. */
export function toCategoryPatch(draft: CategoryEditorDraft, category: AdminCategory): AdminCategoryPatch | undefined {
  const before = draftOf(category)
  const patch: AdminCategoryPatch = {}
  if (!sameTexts(draft.names, before.names)) patch.names = localized(draft.names) ?? { az: '' }
  if (!sameTexts(draft.descriptions, before.descriptions)) patch.descriptions = localized(draft.descriptions) ?? null
  if (!category.parentId && draft.icon && draft.icon !== before.icon) patch.icon = draft.icon
  if (draft.sortOrder.trim() !== before.sortOrder) patch.sortOrder = Number(draft.sortOrder.trim())
  if (draft.isActive !== before.isActive) patch.isActive = draft.isActive
  const ids = category.form ? formFilterIds[category.form] : []
  if (ids.some((id) => (draft.filters[id] ?? false) !== (before.filters[id] ?? false))) {
    patch.filters = ids.map((id) => ({ id, enabled: draft.filters[id] ?? false }))
  }
  if (Object.keys(patch).length === 0) return undefined
  return { ...patch, version: category.version }
}

/** The form's own checks before anything is sent (the same words the API's refusals get). */
export function validateCategoryDraft(draft: CategoryEditorDraft, options: { sub: boolean; isNew: boolean }): CategoryFieldErrors {
  const errors: CategoryFieldErrors = {}
  checkTexts('names', localized(draft.names), NAME_MAX, true, errors)
  checkTexts('descriptions', localized(draft.descriptions), DESCRIPTION_MAX, false, errors)
  const order = draft.sortOrder.trim()
  if (order || !options.isNew) checkSortOrder(order === '' ? Number.NaN : order, errors)
  if (!options.sub) {
    if (!draft.icon) errors.icon = FIELD_MESSAGES.icon['*']
    if (options.isNew && (!draft.form || !formsFor(draft.kind).includes(draft.form))) errors.form = FIELD_MESSAGES.form['*']
  }
  return errors
}
