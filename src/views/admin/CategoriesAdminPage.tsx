'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { categoriesUpdatedAt, categoryIconLabels } from '@/data/admin'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { AdminPage } from '@/features/admin/AdminUi'
import {
  draftFrom,
  emptyDraft,
  formFilters,
  initialAdminCategories,
  matchesCategory,
  slugify,
  sortByOrder,
  splitSubcategories,
  validateDraft,
  type AdminCategory,
  type CategoryDraft,
} from '@/features/admin/categories'
import { localIsoNow, revealWhenStacked, rowClass, useAdminState } from '@/features/admin/lib'
import { formatFullDate } from '@/lib/format'
import type { IconName } from '@/types'

const iconOptions = (Object.entries(categoryIconLabels) as Array<[IconName, string]>).map(([value, label]) => ({ value, label }))

/** Figma "İdarəetmə · Kateqoriyalar · 1440" — category management. */
export default function CategoriesAdminPage() {
  const [rows, setRows] = useAdminState<AdminCategory[]>('categories:rows', initialAdminCategories)
  const [updatedAt, setUpdatedAt] = useAdminState('categories:updated', () => categoriesUpdatedAt)
  const [query, setQuery] = useAdminState('categories:query', () => '')
  /** Row being edited; null = new category form */
  const [editingId, setEditingId] = useState<string | null>(() => sortByOrder(rows)[0]?.id ?? null)
  const [lastEditedId, setLastEditedId] = useState<string | null>(editingId)
  const [draft, setDraft] = useState<CategoryDraft>(() => {
    const row = rows.find((r) => r.id === editingId)
    return row ? draftFrom(row) : emptyDraft(rows)
  })
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState<{ title: string; body: string } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const sorted = sortByOrder(rows)
  const visible = sorted.filter((r) => matchesCategory(r, query))
  const editingRow = rows.find((r) => r.id === editingId)
  const subcategoryCount = rows.reduce((sum, r) => sum + r.subcategories.length, 0)
  const errors = submitted ? validateDraft(draft, rows, editingId) : {}

  const load = (row: AdminCategory | undefined, reveal = false) => {
    setEditingId(row?.id ?? null)
    if (row) setLastEditedId(row.id)
    setDraft(row ? draftFrom(row) : emptyDraft(rows))
    setSubmitted(false)
    setSaved(null)
    if (reveal) requestAnimationFrame(() => revealWhenStacked(panelRef.current))
  }

  const update = (patch: Partial<CategoryDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaved(null)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const found = validateDraft(draft, rows, editingId)
    if (found.name || found.order) {
      document.getElementById(found.name ? 'category-name' : 'category-order')?.focus()
      return
    }
    const name = draft.name.trim()
    const values = {
      name,
      icon: draft.icon,
      subcategories: splitSubcategories(draft.subcategories),
      order: Number(draft.order),
      active: draft.active,
    }
    if (editingRow) {
      const next: AdminCategory = {
        ...editingRow,
        ...values,
        filters: editingRow.filters.map((f) => ({ ...f, enabled: draft.filters[f.id] ?? f.enabled })),
      }
      setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)))
      setDraft(draftFrom(next))
      setSaved({ title: 'Dəyişikliklər yadda saxlanıldı', body: `“${name}” kateqoriyası yeniləndi.` })
    } else {
      let id = slugify(name)
      while (rows.some((r) => r.id === id)) id = `${id}-1`
      const created: AdminCategory = { id, ...values, filters: [] }
      setRows((prev) => [...prev, created])
      setEditingId(id)
      setLastEditedId(id)
      setDraft(draftFrom(created))
      setSaved({ title: 'Kateqoriya əlavə edildi', body: `“${name}” kateqoriyası siyahıya əlavə olundu.` })
    }
    setSubmitted(false)
    setUpdatedAt(localIsoNow().slice(0, 10))
  }

  /** "Ləğv et": drop unsaved edits (a new-category form goes back to the last edited row). */
  const cancel = () => {
    if (editingRow) load(editingRow)
    else load(rows.find((r) => r.id === lastEditedId) ?? sorted[0])
  }

  const checkboxes = [
    { id: 'active', label: 'Aktiv kateqoriya', checked: draft.active, onChange: (v: boolean) => update({ active: v }) },
    ...(editingRow ? formFilters(editingRow) : []).map((f) => ({
      id: f.id,
      label: f.formLabel,
      checked: draft.filters[f.id] ?? f.enabled,
      onChange: (v: boolean) => update({ filters: { ...draft.filters, [f.id]: v } }),
    })),
  ]

  return (
    <AdminPage
      title="Kateqoriya idarəetməsi"
      subtitle={`${rows.length} əsas kateqoriya · ${subcategoryCount} alt kateqoriya · Son yenilənmə: ${formatFullDate(updatedAt)}`}
    >
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-start">
        <TextField
          type="search"
          label="Kateqoriya axtarışı"
          placeholder="Ad və ya alt kateqoriya"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          containerClassName="w-full md:flex-1"
        />
        <Button icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />} onClick={() => load(undefined, true)}>
          Kateqoriya əlavə et
        </Button>
      </div>

      <div className="grid w-full items-start gap-6 xl:grid-cols-[minmax(0,1fr)_358px]">
        <section aria-labelledby="category-list-title" className="flex w-full min-w-0 flex-col gap-2">
          <h2 id="category-list-title" className="sr-only">
            Kateqoriyalar siyahısı
          </h2>
          {visible.length === 0 ? (
            <p className="w-full rounded-lg border border-line bg-surface p-[15px] text-sm leading-[1.5] text-muted">
              Axtarışa uyğun kateqoriya tapılmadı.
            </p>
          ) : (
            <ul className="flex w-full flex-col gap-2">
              {visible.map((row) => {
                const selected = row.id === editingId
                const enabledFilters = row.filters.filter((f) => f.enabled)
                return (
                  <li key={row.id}>
                    <article
                      onClick={() => load(row)}
                      className={rowClass(selected, 'line', 'flex cursor-pointer flex-col gap-3 rounded-lg p-[15px] md:flex-row md:items-start md:gap-4')}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-[5px] leading-[1.5]">
                        <h3 className="text-[14px] font-semibold text-ink">{row.name}</h3>
                        {row.subcategories.length > 0 && <p className="text-[12px] text-muted">{row.subcategories.join(' · ')}</p>}
                        {enabledFilters.length > 0 && (
                          <p className="text-[11px] text-muted">Filtrlər: {enabledFilters.map((f) => f.label).join(' · ')}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-4 md:contents">
                        <Badge tone={row.active ? 'success' : 'neutral'}>{row.active ? 'Aktiv' : 'Deaktiv'}</Badge>
                        <Button
                          variant="secondary"
                          aria-pressed={selected}
                          aria-label={`Redaktə et: ${row.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            load(row, true)
                          }}
                        >
                          Redaktə et
                        </Button>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div ref={panelRef} className="w-full min-w-0 scroll-mt-4">
          <Panel className="w-full">
            <form noValidate onSubmit={save} aria-labelledby="category-form-title" className="flex w-full flex-col items-start gap-5">
              <h2 id="category-form-title" className="w-full text-[23px] leading-[1.35] font-normal text-ink">
                {editingRow ? 'Kateqoriyanı redaktə et' : 'Kateqoriya əlavə et'}
              </h2>
              {saved && (
                <Notice tone="success" title={saved.title}>
                  {saved.body}
                </Notice>
              )}
              <TextField
                id="category-name"
                label="Kateqoriya adı"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                error={errors.name}
                containerClassName="w-full"
                autoComplete="off"
              />
              <TextAreaField
                label="Alt kateqoriyalar"
                value={draft.subcategories}
                onChange={(e) => update({ subcategories: e.target.value })}
                containerClassName="w-full"
              />
              <TextField
                id="category-order"
                label="Görünmə sırası"
                inputMode="numeric"
                value={draft.order}
                onChange={(e) => update({ order: e.target.value })}
                error={errors.order}
                containerClassName="w-full"
              />
              <div className="relative w-full">
                <SelectField
                  label="Kateqoriya işarəsi seçin"
                  value={draft.icon}
                  onChange={(e) => update({ icon: e.target.value as IconName })}
                  options={iconOptions}
                  containerClassName="w-full"
                />
                <CategoryIcon
                  name={draft.icon}
                  size={18}
                  className="pointer-events-none absolute top-[47px] right-[38px] shrink-0 -translate-y-1/2 text-forest"
                />
              </div>
              <fieldset className="w-full">
                <legend className="sr-only">Kateqoriya parametrləri</legend>
                <p className="text-[13px] leading-[1.5] text-ink">
                  {checkboxes.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ' ·\u00a0'}
                      <label className="inline cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={c.checked}
                          onChange={(e) => c.onChange(e.target.checked)}
                          className="m-0 mr-[3px] inline-block size-3 cursor-pointer align-[-1px] accent-forest"
                        />
                        {c.label}
                      </label>
                    </span>
                  ))}
                </p>
              </fieldset>
              <Notice tone="warning" title="Mövcud elanlar qorunur">
                Kateqoriyanı deaktiv etməzdən əvvəl ona bağlı elanların köçürülməsini planlaşdırın.
              </Notice>
              <Button type="submit" fullWidth>
                Yadda saxla
              </Button>
              <Button variant="secondary" fullWidth onClick={cancel}>
                Ləğv et
              </Button>
            </form>
          </Panel>
        </div>
      </div>
    </AdminPage>
  )
}
