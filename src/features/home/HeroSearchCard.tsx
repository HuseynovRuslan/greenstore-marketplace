'use client'

import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, MapPin, Search } from 'lucide-react'
import { Listbox, listboxChevronClass } from '@/components/ui/Listbox'
import { listingTotals } from '@/data/categories'
import { cities, cityListingCounts } from '@/data/cities'
import { cn, formatNumber } from '@/lib/format'
import { FilterChips } from './FilterChips'
import { HeroCategories } from './HeroCategories'
import { HeroFilterSheet, MobileFilterRow } from './HeroFilterSheet'
import { HERO_QUERY_ID, HERO_SEARCH_ID } from './ids'
import { emptyHeroFilters, filtersForTab, heroSearchUrl, heroTabs, priceError, type FilterId, type HeroFilters, type HeroTab } from './heroSearch'


const cityOptions = [
  { value: '', label: 'Bütün şəhərlər', meta: formatNumber(listingTotals.all) },
  ...cities.map((c) => ({ value: c.id, label: c.name, meta: formatNumber(cityListingCounts[c.id] ?? 0) })),
]

/**
 * Home hero search (docs/design/variant-2): the card with Hamısı / Məhsullar / Xidmətlər, the search row
 * (text · city · «Axtar») and the filter chips (≥ md); on phones the scrolling chip row and the «Filtrlər» sheet;
 * then the categories row, whose selected item follows the Kateqoriya filter. Submitting opens the catalogue with
 * its own URL params (heroSearch.ts); without JavaScript the form is a plain GET to /elanlar.
 */
export function HeroSearchCard() {
  const router = useRouter()
  const [tab, setTab] = useState<HeroTab>('all')
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [filters, setFilters] = useState<HeroFilters>(emptyHeroFilters)
  const [showError, setShowError] = useState(false)
  const [sheet, setSheet] = useState<{ open: boolean; focus?: FilterId }>({ open: false })
  const errorId = useId()
  const error = showError ? priceError(filters) : undefined
  const placeholder = heroTabs.find((t) => t.value === tab)?.placeholder

  const changeTab = (next: HeroTab) => {
    setTab(next)
    setFilters((current) => filtersForTab(next, current))
  }

  /** Opens the catalogue; false (and the error shown) when the price range is invalid. */
  const search = () => {
    if (priceError(filters)) {
      setShowError(true)
      return false
    }
    setShowError(false)
    router.push(heroSearchUrl({ tab, q, city, filters }))
    return true
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    search()
  }

  return (
    <>
      <div
        id={HERO_SEARCH_ID}
        // relative z-10: its popovers paint above the categories row, which also animates in.
        className="relative z-10 w-full max-w-[1080px] animate-fade-up scroll-mt-28 rounded-2xl border border-line-strong bg-surface shadow-search motion-reduce:animate-none md:rounded-search"
      >
        <TypeTabs value={tab} onChange={changeTab} />

        <form role="search" aria-label="Elan axtarışı" action="/elanlar" method="get" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-2 p-2.5 md:flex-row md:items-center md:gap-2.5 md:pt-3.5 md:pr-3.5 md:pb-2.5 md:pl-[22px]">
            <label
              htmlFor={HERO_QUERY_ID}
              className="flex h-12 min-w-0 cursor-text items-center gap-2.5 rounded-option border border-line bg-cream px-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-olive md:h-[52px] md:flex-1 md:gap-3 md:border-0 md:bg-transparent md:px-0"
            >
              <Search aria-hidden size={20} strokeWidth={2} className="shrink-0 text-muted" />
              <span className="sr-only">Axtarış sözü</span>
              <input
                id={HERO_QUERY_ID}
                type="search"
                name="q"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted md:text-[17px]"
              />
            </label>
            <div className="flex gap-2 md:contents">
              <CityField value={city} onChange={setCity} />
              <button
                type="submit"
                aria-describedby={error ? errorId : undefined}
                className="h-12 shrink-0 rounded-option bg-forest px-6 text-base leading-[normal] font-semibold text-white transition-colors duration-(--dur-fast) hover:bg-forest-hover md:h-[52px] md:rounded-xl md:px-[30px]"
              >
                Axtar
              </button>
            </div>
          </div>

          <FilterChips tab={tab} filters={filters} onChange={setFilters} className="hidden px-[22px] pt-1 pb-4 md:flex" />
          {error && (
            <p id={errorId} role="alert" className="px-3 pb-3 text-xs leading-[1.5] text-danger md:-mt-1.5 md:px-[22px] md:pb-4">
              {error}
            </p>
          )}
        </form>
      </div>

      <MobileFilterRow
        tab={tab}
        filters={filters}
        onChange={setFilters}
        sheetOpen={sheet.open}
        onOpenSheet={(focus) => setSheet({ open: true, focus })}
        className="-mx-5 animate-fade-up self-stretch px-5 [animation-delay:60ms] motion-reduce:animate-none md:hidden"
      />
      <HeroFilterSheet
        open={sheet.open}
        focus={sheet.focus}
        tab={tab}
        filters={filters}
        onChange={setFilters}
        onClose={() => setSheet({ open: false })}
        onSearch={search}
      />

      <HeroCategories selected={filters.category} className="-mx-5 self-stretch border-t border-line pt-4 md:-mx-7 lg:mx-0 lg:pt-[22px]" />
    </>
  )
}

/**
 * «Elan növü»: a native radio group styled as underline tabs — one Tab stop, arrow keys switch, and screen
 * readers announce "radio button, 2 of 3, checked". One shared indicator moves with translateX + scaleX; until it
 * has been measured (server HTML) the checked tab draws its own underline.
 */
function TypeTabs({ value, onChange }: { value: HeroTab; onChange: (tab: HeroTab) => void }) {
  const name = useId()
  const listRef = useRef<HTMLFieldSetElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    const bar = barRef.current
    if (!list || !bar) return
    const place = () => {
      const checked = list.querySelector<HTMLElement>('[data-checked]')
      if (!checked) return
      bar.style.setProperty('--tab-x', `${checked.offsetLeft}px`)
      bar.style.setProperty('--tab-w', String(checked.offsetWidth))
      if (!list.hasAttribute('data-ready')) {
        // Apply the first position before the transition is switched on, so the bar doesn't slide in from 0.
        bar.getBoundingClientRect()
        list.setAttribute('data-ready', '')
      }
    }
    place()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(place)
    observer.observe(list)
    return () => observer.disconnect()
  }, [value])

  return (
    <fieldset ref={listRef} className="group relative flex min-w-0 border-b border-line px-2 pt-0.5 md:gap-1.5 md:px-[18px] md:pt-1.5">
      <legend className="sr-only">Elan növü</legend>
      {heroTabs.map((t) => {
        const checked = t.value === value
        return (
          <label
            key={t.value}
            data-checked={checked || undefined}
            className={cn(
              'relative flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-[7px] rounded-t-option px-3 text-sm leading-[normal] font-semibold transition-colors duration-(--dur-fast) md:h-[46px] md:flex-none md:text-[15px]',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-olive',
              checked ? 'text-forest' : 'text-ink-soft hover:text-forest',
            )}
          >
            <input type="radio" name={name} value={t.value} checked={checked} onChange={() => onChange(t.value)} className="sr-only" />
            {t.label}
            <span className="max-md:hidden">
              {' '}
              <span className="text-[13px] font-medium text-muted tabular-nums">{formatNumber(t.count)}</span>
              <span className="sr-only"> elan</span>
            </span>
            {checked && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-forest group-data-ready:hidden" />}
          </label>
        )
      })}
      <span
        ref={barRef}
        aria-hidden
        className="pointer-events-none absolute -bottom-px left-0 h-0.5 w-px origin-left bg-forest opacity-0 [transform:translateX(var(--tab-x,0))_scaleX(var(--tab-w,0))] group-data-ready:opacity-100 motion-safe:group-data-ready:transition-transform motion-safe:group-data-ready:duration-(--dur-base) motion-safe:group-data-ready:ease-out"
      />
    </fieldset>
  )
}

/**
 * City field: the custom Listbox from md up, a native <select> on phones (their own pickers are better there).
 * Both show the same value; only the native one has a `name`, for the no-JavaScript form submit.
 */
function CityField({ value, onChange }: { value: string; onChange: (city: string) => void }) {
  const pin = <MapPin aria-hidden size={18} strokeWidth={2} className="shrink-0 text-muted" />
  return (
    <>
      <Listbox
        label="Şəhər"
        value={value}
        onChange={onChange}
        options={cityOptions}
        icon={pin}
        className="hidden h-[52px] w-[196px] shrink-0 border-l border-line pl-1.5 md:block"
      />
      <label className="relative flex h-12 min-w-0 flex-1 items-center gap-2 rounded-option border border-line bg-cream pl-3 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-olive md:hidden">
        {pin}
        <span className="sr-only">Şəhər</span>
        <select
          name="seher"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-9 text-[15px] leading-[normal] font-medium text-ink outline-none"
        >
          {cityOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden size={16} strokeWidth={2} className={cn(listboxChevronClass, 'pointer-events-none absolute right-3')} />
      </label>
    </>
  )
}
