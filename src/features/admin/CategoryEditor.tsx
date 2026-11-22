'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { CheckboxField, FieldGroup } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { categoryIconLabels } from '@/data/admin'
import type { AdminCategory, CategoryForm, CategoryKind, IconName } from '@/types'
import { createCategory, updateCategory } from './actions'
import {
  categoryHref,
  DESCRIPTION_MAX,
  draftOf,
  filterLabels,
  formFilterIds,
  formLabels,
  formsFor,
  kindLabels,
  NAME_MAX,
  toCategoryInput,
  toCategoryPatch,
  validateCategoryDraft,
  type CategoryEditorDraft,
  type CategoryFieldErrors,
} from './categoriesApi'

const iconOptions = (Object.entries(categoryIconLabels) as Array<[IconName, string]>).map(([value, label]) => ({ value, label }))
const LANGUAGES = [
  { id: 'az', label: 'Azərbaycanca' },
  { id: 'ru', label: 'Rusca' },
  { id: 'en', label: 'İngiliscə' },
] as const

interface Props {
  /** The row being edited; none for a new one */
  category?: AdminCategory
  /** A new sub-category's category */
  parent?: AdminCategory
  /** The list's search, kept in the address after a save */
  q: string
}

/**
 * DATA_SOURCE=api: the edit panel of «Kateqoriya idarəetməsi» for one category or sub-category, or for a new one.
 * Names and descriptions in the three languages (Azerbaijani required; Russian and English may wait for a translator),
 * the icon, the order, on or off, and the filters its form has. Saves through a Server Action with the version the
 * admin saw; the page then reloads with a notice.
 */
export function CategoryEditor({ category, parent, q }: Props) {
  const router = useRouter()
  const isNew = !category
  const sub = Boolean(category?.parentId ?? parent)
  const [draft, setDraft] = useState<CategoryEditorDraft>(() => draftOf(category, parent))
  const [errors, setErrors] = useState<CategoryFieldErrors>({})
  const [failure, setFailure] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  const update = (patch: Partial<CategoryEditorDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setFailure(undefined)
  }
  const setText = (group: 'names' | 'descriptions', lang: 'az' | 'ru' | 'en', value: string) => {
    setDraft((d) => ({ ...d, [group]: { ...d[group], [lang]: value } }))
    if (errors[`${group}.${lang}`]) setErrors((e) => ({ ...e, [`${group}.${lang}`]: undefined }))
  }

  const form = (category?.form ?? (draft.form || undefined)) as CategoryForm | undefined
  const filterIds = !sub && form ? formFilterIds[form] : []

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const found = validateCategoryDraft(draft, { sub, isNew })
    setErrors(found)
    const first = Object.keys(found).find((k) => found[k])
    if (first) {
      document.getElementById(`category-${first.replace('.', '-')}`)?.focus()
      return
    }
    const patch = category ? toCategoryPatch(draft, category) : undefined
    if (category && !patch) return setFailure('Dəyişiklik yoxdur.')
    setBusy(true)
    setFailure(undefined)
    const result = await (category ? updateCategory(category.id, patch!) : createCategory(toCategoryInput(draft, parent))).catch(() => ({
      ok: false as const,
      error: 'Göndərmək alınmadı. İnternet bağlantısını yoxlayın.',
      fields: undefined,
      stale: false,
    }))
    setBusy(false)
    if (!result.ok) {
      setFailure(result.error)
      if (result.fields) setErrors(result.fields)
      if ('stale' in result && result.stale) startTransition(() => router.refresh())
      return
    }
    startTransition(() => router.replace(categoryHref({ q }, { item: result.category.id }, isNew ? 'created' : 'updated'), { scroll: false }))
  }

  const title = isNew ? (parent ? `Alt kateqoriya əlavə et: ${parent.names.az}` : 'Kateqoriya əlavə et') : sub ? 'Alt kateqoriyanı redaktə et' : 'Kateqoriyanı redaktə et'

  return (
    <Panel className="w-full">
      <form noValidate onSubmit={save} aria-labelledby="category-form-title" className="flex w-full flex-col items-start gap-5">
        <h2 id="category-form-title" className="w-full text-lg leading-[1.3] font-semibold tracking-[-0.01em] break-words text-forest">
          {title}
        </h2>

        {isNew && !parent ? (
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Növ"
              value={draft.kind}
              onChange={(e) => {
                const kind = e.target.value as CategoryKind
                update({ kind, form: formsFor(kind)[0], filters: {} })
              }}
              options={(Object.keys(kindLabels) as CategoryKind[]).map((k) => ({ value: k, label: kindLabels[k] }))}
              containerClassName="w-full"
            />
            <SelectField
              id="category-form"
              label="Elan forması"
              value={draft.form}
              error={errors.form}
              onChange={(e) => update({ form: e.target.value as CategoryForm, filters: {} })}
              options={formsFor(draft.kind).map((f) => ({ value: f, label: formLabels[f] }))}
              containerClassName="w-full"
            />
          </div>
        ) : (
          <p className="w-full text-[13px] leading-[1.5] text-muted">
            {[kindLabels[category?.kind ?? parent?.kind ?? 'product'], !sub && form ? formLabels[form] : parent ? `«${parent.names.az}» kateqoriyasının alt kateqoriyası` : undefined, category ? `ünvan: ${category.id}` : undefined]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <FieldGroup legend="Ad" className="w-full">
          <div className="flex w-full flex-col gap-3">
            {LANGUAGES.map(({ id, label }) => (
              <TextField
                key={id}
                id={`category-names-${id}`}
                label={label}
                optional={id !== 'az'}
                value={draft.names[id]}
                maxLength={NAME_MAX + 20}
                error={errors[`names.${id}`]}
                onChange={(e) => setText('names', id, e.target.value)}
                containerClassName="w-full"
                autoComplete="off"
              />
            ))}
          </div>
        </FieldGroup>

        <FieldGroup legend="Qısa təsvir" optional className="w-full">
          <div className="flex w-full flex-col gap-3">
            {LANGUAGES.map(({ id, label }) => (
              <TextAreaField
                key={id}
                id={`category-descriptions-${id}`}
                label={label}
                optional={id !== 'az'}
                rows={2}
                value={draft.descriptions[id]}
                maxLength={DESCRIPTION_MAX + 50}
                error={errors[`descriptions.${id}`]}
                onChange={(e) => setText('descriptions', id, e.target.value)}
                className="min-h-[72px]"
                containerClassName="w-full"
              />
            ))}
          </div>
        </FieldGroup>

        {!sub && (
          <div className="relative w-full">
            <SelectField
              id="category-icon"
              label="Kateqoriya işarəsi seçin"
              value={draft.icon}
              error={errors.icon}
              onChange={(e) => update({ icon: e.target.value as IconName })}
              options={[...(draft.icon ? [] : [{ value: '', label: 'Seçin' }]), ...iconOptions]}
              containerClassName="w-full"
            />
            {draft.icon && <CategoryIcon name={draft.icon} size={18} className="pointer-events-none absolute top-[47px] right-[38px] shrink-0 -translate-y-1/2 text-forest" />}
          </div>
        )}

        <TextField
          id="category-sortOrder"
          label="Görünmə sırası"
          optional={isNew}
          hint={isNew ? 'Boş qalsa, siyahının sonuna düşür.' : 'Kiçik rəqəm əvvəl göstərilir.'}
          inputMode="numeric"
          value={draft.sortOrder}
          error={errors.sortOrder}
          onChange={(e) => update({ sortOrder: e.target.value })}
          containerClassName="w-full"
        />

        <fieldset className="flex w-full flex-col">
          <legend className="text-sm leading-[1.5] font-semibold text-ink">Parametrlər</legend>
          <CheckboxField label={sub ? 'Aktiv alt kateqoriya' : 'Aktiv kateqoriya'} checked={draft.isActive} onChange={(e) => update({ isActive: e.target.checked })} />
          {filterIds.map((id) => (
            <CheckboxField
              key={id}
              label={`${filterLabels[id] ?? id} filtri`}
              checked={draft.filters[id] ?? false}
              onChange={(e) => update({ filters: { ...draft.filters, [id]: e.target.checked } })}
            />
          ))}
          {errors.filters && <p className="text-xs leading-[1.5] text-danger">{errors.filters}</p>}
          {form === 'plant' && <p className="text-xs leading-[1.5] text-muted">Kataloq bu filtrlərdən hələlik yalnız «Kök sistemi»-ni bu ayardan götürür.</p>}
        </fieldset>

        {isNew ? (
          <Notice tone="warning" title="Saytın menyusu hələ dəyişmir">
            Yeni {parent ? 'alt kateqoriya' : 'kateqoriya'} saytın menyusunda və «Elan yerləşdir» formasında hələ görünmür: bu siyahılar hələlik saytın kodundadır.
          </Notice>
        ) : (
          <Notice tone="warning" title="Mövcud elanlar qorunur">
            {sub
              ? 'Deaktiv edilən alt kateqoriya «Elan yerləşdir» formasında hələ görünür, amma yeni elan qəbul etmir. Onu söndürməzdən əvvəl elanların köçürülməsini planlaşdırın.'
              : 'Kateqoriyanı deaktiv etməzdən əvvəl ona bağlı elanların köçürülməsini planlaşdırın.'}
          </Notice>
        )}

        {failure && (
          <Notice tone="danger" title="Yadda saxlanılmadı">
            {failure}
          </Notice>
        )}
        <Button type="submit" fullWidth disabled={busy} aria-busy={busy}>
          {busy ? 'Yadda saxlanılır…' : 'Yadda saxla'}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={busy}
          onClick={() => {
            setDraft(draftOf(category, parent))
            setErrors({})
            setFailure(undefined)
          }}
        >
          Ləğv et
        </Button>
      </form>
    </Panel>
  )
}
