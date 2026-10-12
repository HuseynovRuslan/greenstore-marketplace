'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { cities } from '@/data/cities'
import { serviceCategories } from '@/data/services'
import { cn, formatNumber } from '@/lib/format'
import { SortSelect } from './SortSelect'
import { parseServiceQuery, providerTabs, type ServiceSort } from './query'

const areaOptions = [{ value: '', label: 'Bütün Azərbaycan' }, ...cities.map((c) => ({ value: c.id, label: c.name }))]

/**
 * Writes catalogue changes to the URL (the server renders the results); any filter change returns to page 1.
 * `query` is the current query string of /xidmetler.
 */
function useServicesUpdate(query: string) {
  const router = useRouter()
  return (patch: Record<string, string | undefined>, { keepPage = false } = {}) => {
    const next = new URLSearchParams(query)
    // The home hero sends the city as `seher`; the catalogue uses `erazi`.
    const legacyCity = next.get('seher')
    next.delete('seher')
    if (legacyCity && !next.has('erazi') && !('erazi' in patch)) next.set('erazi', legacyCity.split(',')[0])
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!keepPage) next.delete('sehife')
    router.push(next.size ? `/xidmetler?${next}` : '/xidmetler', { scroll: false })
  }
}

/** "Xidmət axtarışı": typed values are applied on "Axtar"; they re-sync when the URL changes elsewhere. */
export function ServicesSearchForm({ query }: { query: string }) {
  const parsed = parseServiceQuery(new URLSearchParams(query))
  const update = useServicesUpdate(query)
  const key = `${parsed.q}|${parsed.cityId ?? ''}`
  const [q, setQ] = useState(parsed.q)
  const [area, setArea] = useState(parsed.cityId ?? '')
  const [prevKey, setPrevKey] = useState(key)
  if (key !== prevKey) {
    setPrevKey(key)
    setQ(parsed.q)
    setArea(parsed.cityId ?? '')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update({ q: q.trim() || undefined, erazi: area || undefined })
  }

  return (
    <form role="search" onSubmit={submit} className="flex w-full flex-col items-stretch gap-3 md:flex-row md:items-start">
      <TextField
        containerClassName="md:flex-1"
        label="Xidmət axtarışı"
        name="q"
        enterKeyHint="search"
        placeholder="Xidmətin adı və ya açar söz"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <SelectField
        containerClassName="md:flex-1"
        label="Xidmət ərazisi seçin"
        name="erazi"
        value={area}
        onChange={(e) => setArea(e.target.value)}
        options={areaOptions}
      />
      <Button type="submit" icon={<Search aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
        Axtar
      </Button>
    </form>
  )
}

/** "Xidmət kateqoriyaları" — toggles `kateqoriya`. */
export function ServiceCategoryToggles({ query }: { query: string }) {
  const parsed = parseServiceQuery(new URLSearchParams(query))
  const update = useServicesUpdate(query)
  return (
    <div role="group" aria-label="Xidmət kateqoriyaları" className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
      {serviceCategories.map((c) => {
        const active = parsed.categoryId === c.id
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            onClick={() => update({ kateqoriya: active ? undefined : c.id })}
            className={cn(
              'flex min-h-[74px] items-start rounded-lg p-3.5 text-left text-[13px] leading-[1.5] font-semibold transition-colors',
              'focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:outline-none focus-visible:ring-inset',
              active ? 'bg-forest text-white hover:bg-forest-hover' : 'bg-mint text-forest hover:bg-[#dfe8de]',
            )}
          >
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

/** "Xidmət filtrləri": provider tabs, result count and sort. */
export function ServiceFilterBar({ query, displayTotal }: { query: string; displayTotal: number }) {
  const parsed = parseServiceQuery(new URLSearchParams(query))
  const update = useServicesUpdate(query)
  return (
    <div className="flex w-full flex-col gap-3.5">
      <div role="tablist" aria-label="Xidmət göstərən növü" className="flex w-full flex-wrap items-start gap-2">
        {providerTabs.map((t) => {
          const active = parsed.tab === t.value
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="xidmet-elanlari"
              onClick={() => update({ nov: t.value === 'all' ? undefined : t.value })}
              className={cn(
                'flex min-h-11 items-start rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap transition-colors',
                active ? 'bg-forest font-semibold text-white' : 'bg-mint text-forest hover:bg-[#dfe8de]',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex w-full items-start justify-between gap-4">
        <p role="status" className="text-[13px] leading-[1.5] whitespace-nowrap text-ink">
          {formatNumber(displayTotal)} xidmət elanı
        </p>
        <SortSelect value={parsed.sort} onChange={(sort: ServiceSort) => update({ siralama: sort === 'newest' ? undefined : sort })} />
      </div>
    </div>
  )
}
