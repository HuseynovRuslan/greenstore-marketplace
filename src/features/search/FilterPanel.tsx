import { useId, useMemo, useState, type FormEvent } from 'react'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { productCategories } from '@/data/categories'
import { cn, formatNumber } from '@/lib/format'
import { CityMultiSelect } from './CityMultiSelect'
import { speciesOptions, subcategoryOptions } from './taxonomy'
import {
  agePresets,
  ageLabel,
  emptySearchState,
  heightLabel,
  heightPresets,
  priceError,
  runSearch,
  sellerTypeOptions,
  withCustomRange,
  type SearchState,
  type SellerTypeParam,
} from './searchState'

interface FilterPanelProps {
  /** Filters currently applied (from the URL). The panel edits a draft copy of them. */
  applied: SearchState
  /** Live value of the "Elanlarda axtarış" field, so the "N elanı göstər" count matches what will be applied. */
  q: string
  onApply: (next: SearchState) => void
  onClear: () => void
  className?: string
}

/**
 * Figma "Filtr yan paneli" / "Məlumat paneli" (desktop sidebar, also the body of the mobile bottom sheet).
 * Fields edit a draft; "N elanı göstər" applies it (live count), "Filtrləri təmizlə" resets every filter.
 * Parents remount the panel (key = query string) so the draft always starts from the applied URL state.
 */
export function FilterPanel({ applied, q, onApply, onClear, className }: FilterPanelProps) {
  const [draft, setDraft] = useState<SearchState>(applied)
  const headingId = useId()
  const error = priceError(draft)
  const count = useMemo(() => (error ? 0 : runSearch({ ...draft, q }).length), [draft, q, error])
  const update = (patch: Partial<SearchState>) => setDraft((d) => ({ ...d, ...patch }))

  const subOptions = subcategoryOptions(draft.categoryId)
  const species = speciesOptions(draft.categoryId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (error) return
    onApply({ ...draft, q })
  }

  return (
    // p 23 + the 1 px border = Figma's 24 px inset (Figma strokes sit inside the 276 px box).
    <Panel className={cn('p-[23px]', className)}>
      <form onSubmit={submit} noValidate aria-labelledby={headingId} className="flex w-full flex-col items-start gap-5">
        <h2 id={headingId} className="text-[23px] leading-[1.35] font-normal text-ink">
          Filtrlər
        </h2>
        <SelectField
          containerClassName="w-full"
          label="Kateqoriya seçin"
          value={draft.categoryId}
          onChange={(e) => update({ categoryId: e.target.value, subcategory: '', species: '' })}
          options={[{ value: '', label: 'Bütün kateqoriyalar' }, ...productCategories.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <SelectField
          containerClassName="w-full"
          label="Alt kateqoriya seçin"
          value={draft.subcategory}
          disabled={!subOptions.length}
          onChange={(e) => update({ subcategory: e.target.value })}
          options={[{ value: '', label: 'Bütün alt kateqoriyalar' }, ...subOptions]}
        />
        <CityMultiSelect label="Şəhər seçin" value={draft.cityIds} onChange={(cityIds) => update({ cityIds })} />
        <div className="flex w-full flex-col gap-[7px]">
          <div className="flex w-full gap-2.5">
            <TextField
              containerClassName="flex-1"
              label="Min. qiymət, ₼"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={draft.min}
              aria-invalid={error ? true : undefined}
              onChange={(e) => update({ min: e.target.value })}
            />
            <TextField
              containerClassName="flex-1"
              label="Maks. qiymət, ₼"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="İstənilən"
              value={draft.max}
              aria-invalid={error ? true : undefined}
              onChange={(e) => update({ max: e.target.value })}
            />
          </div>
          {error && (
            <p role="alert" className="w-full text-xs leading-[1.5] text-danger">
              {error}
            </p>
          )}
        </div>
        <SelectField
          containerClassName="w-full"
          label={draft.categoryId === 'agaclar' ? 'Ağac növü seçin' : 'Növ seçin'}
          value={draft.species}
          onChange={(e) => update({ species: e.target.value })}
          options={[{ value: '', label: 'Bütün növlər' }, ...species]}
        />
        <SelectField
          containerClassName="w-full"
          label="Hündürlük seçin"
          value={draft.height}
          onChange={(e) => update({ height: e.target.value })}
          options={withCustomRange(heightPresets, draft.height, heightLabel)}
        />
        <SelectField
          containerClassName="w-full"
          label="Yaş seçin"
          value={draft.age}
          onChange={(e) => update({ age: e.target.value })}
          options={withCustomRange(agePresets, draft.age, ageLabel)}
        />
        {/* Every public listing is on sale, so "Satışda olanlar" is the only availability state buyers can see. */}
        <SelectField containerClassName="w-full" label="Mövcudluq seçin" value="satisda" onChange={() => {}} options={[{ value: 'satisda', label: 'Satışda olanlar' }]} />
        <label className="flex w-full cursor-pointer items-center gap-[5px] text-sm leading-[1.5] text-ink">
          <input
            type="checkbox"
            checked={draft.delivery}
            onChange={(e) => update({ delivery: e.target.checked })}
            className="size-[13px] shrink-0 cursor-pointer accent-forest"
          />
          Çatdırılma mümkündür
        </label>
        <SelectField
          containerClassName="w-full"
          label="Satıcı növü seçin"
          value={draft.sellerType}
          onChange={(e) => update({ sellerType: e.target.value as SellerTypeParam })}
          options={sellerTypeOptions}
        />
        <Button type="submit" fullWidth disabled={Boolean(error)}>
          {formatNumber(count)} elanı göstər
        </Button>
        <Button
          variant="tertiary"
          fullWidth
          onClick={() => {
            setDraft({ ...emptySearchState })
            onClear()
          }}
        >
          Filtrləri təmizlə
        </Button>
      </form>
    </Panel>
  )
}
