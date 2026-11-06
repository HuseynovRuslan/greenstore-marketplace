'use client'

import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import type { ListboxOption } from '@/components/ui/Listbox'
import { cities, cityName } from '@/data/cities'
import { HERO_QUERY_ID, HERO_SEARCH_ID } from '@/features/home/ids'
import { cn, formatNumber } from '@/lib/format'
import { CityField } from './CityField'
import { PARAM, QUERY_MAX } from './filterDefs'

export interface CityCounts {
  all: number
  byCity: Record<string, number>
}

interface CatalogSearchCardProps {
  q: string
  cityIds: string[]
  /** The page's query string: its other filters ride along as hidden inputs when the form is sent without JavaScript. */
  query: string
  /** Listing counts per city for the current filters (without the city); no counts are shown without it. */
  cityCounts?: CityCounts
  onSearch: (q: string, cityIds: string[]) => void
  className?: string
}

/**
 * The catalogue's one search field (Variant 2): the home search card without its tabs, at the top of /elanlar and
 * the category pages. Search word · city · «Axtar». It carries the hero ids, so the header's search pill leads back
 * to it once it has scrolled away. Older links with several cities keep them as one extra option.
 */
export function CatalogSearchCard({ q, cityIds, query, cityCounts, onSearch, className }: CatalogSearchCardProps) {
  const urlCity = cityIds.join(',')
  const [text, setText] = useState(q)
  const [city, setCity] = useState(urlCity)
  // Typed values re-sync whenever the URL changes elsewhere (chips, «Sıfırla», Back).
  const [synced, setSynced] = useState(`${q}|${urlCity}`)
  if (synced !== `${q}|${urlCity}`) {
    setSynced(`${q}|${urlCity}`)
    setText(q)
    setCity(urlCity)
  }

  const count = (n: number | undefined) => (cityCounts ? formatNumber(n ?? 0) : undefined)
  const options: ListboxOption[] = [
    { value: '', label: 'Bütün şəhərlər', meta: count(cityCounts?.all) },
    ...cities.map((c) => ({ value: c.id, label: c.name, meta: count(cityCounts?.byCity[c.id]) })),
  ]
  if (cityIds.length > 1) options.push({ value: urlCity, label: cityIds.map(cityName).join(', ') })

  const hidden = [...new URLSearchParams(query)].filter(([key]) => key !== PARAM.q && key !== PARAM.city && key !== PARAM.page)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(text.trim(), city ? city.split(',') : [])
  }

  return (
    <div
      id={HERO_SEARCH_ID}
      className={cn('w-full scroll-mt-28 rounded-2xl border border-line-strong bg-surface shadow-search md:rounded-search', className)}
    >
      <form role="search" aria-label="Elan axtarışı" action="/elanlar" method="get" onSubmit={submit}>
        {hidden.map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <div className="flex flex-col gap-2 p-2.5 md:flex-row md:items-center md:gap-2.5 md:py-2.5 md:pr-2.5 md:pl-[22px]">
          {/* No focus ring on the field (as on the home card): the caret shows where focus is. */}
          <label
            htmlFor={HERO_QUERY_ID}
            className="flex h-12 min-w-0 cursor-text items-center gap-2.5 rounded-option border border-line bg-cream px-3 md:h-[52px] md:flex-1 md:gap-3 md:border-0 md:bg-transparent md:px-0"
          >
            <Search aria-hidden size={20} strokeWidth={2} className="shrink-0 text-muted" />
            <span className="sr-only">Axtarış sözü</span>
            <input
              id={HERO_QUERY_ID}
              type="search"
              name={PARAM.q}
              autoComplete="off"
              enterKeyHint="search"
              maxLength={QUERY_MAX}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Məsələn, zeytun ağacı"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted md:text-[17px]"
            />
          </label>
          <div className="flex gap-2 md:contents">
            <CityField value={city} onChange={setCity} options={options} />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-option bg-forest px-6 text-base leading-[normal] font-semibold text-white transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-forest-hover active:scale-[0.97] motion-reduce:active:scale-100 md:h-[52px] md:rounded-xl md:px-[30px]"
            >
              Axtar
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
