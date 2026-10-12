import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { cities } from '@/data/cities'
import { serviceCategories } from '@/data/services'
import { cn, formatNumber } from '@/lib/format'
import { Breadcrumbs, InfoNotice, PageContent, PageHeading } from '@/features/services/ui'
import { ServiceListingCard } from '@/features/services/ServiceListingCard'
import { Pagination } from '@/features/services/Pagination'
import { SortSelect } from '@/features/services/SortSelect'
import { parseServiceQuery, platformServiceTotal, providerTabs, searchServices, type ServiceSort } from '@/features/services/query'

const areaOptions = [{ value: '', label: 'Bütün Azərbaycan' }, ...cities.map((c) => ({ value: c.id, label: c.name }))]

/** Figma "YARPAQ · Xidmətlər · 1440" — services catalogue, state kept in the URL. */
export default function ServicesPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => parseServiceQuery(params), [params])
  const result = useMemo(() => searchServices(query), [query])
  const resultsRef = useRef<HTMLDivElement>(null)

  // Search panel is a form: typed values are applied on "Axtar". Re-sync when the URL changes elsewhere (back/forward, links).
  const [q, setQ] = useState(query.q)
  const [area, setArea] = useState(query.cityId ?? '')
  const [prevKey, setPrevKey] = useState(`${query.q}|${query.cityId ?? ''}`)
  const key = `${query.q}|${query.cityId ?? ''}`
  if (key !== prevKey) {
    setPrevKey(key)
    setQ(query.q)
    setArea(query.cityId ?? '')
  }

  /** Writes changes to the URL; any filter change returns to page 1. */
  const update = (patch: Record<string, string | undefined>, { keepPage = false } = {}) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      // The home hero sends the city as `seher`; the catalogue uses `erazi`.
      const legacyCity = next.get('seher')
      next.delete('seher')
      if (legacyCity && !next.has('erazi') && !('erazi' in patch)) next.set('erazi', legacyCity.split(',')[0])
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      if (!keepPage) next.delete('sehife')
      return next
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update({ q: q.trim() || undefined, erazi: area || undefined })
  }

  const clearAll = () => {
    setQ('')
    setArea('')
    setParams(new URLSearchParams())
  }

  // Bring the first card into view after switching pages.
  const pageRef = useRef(result.page)
  useEffect(() => {
    if (pageRef.current !== result.page) {
      pageRef.current = result.page
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result.page])

  return (
    <PageContent>
      <Breadcrumbs items={[{ label: 'Ana səhifə', to: '/' }, { label: 'Landşaft və bağçılıq xidmətləri' }]} />
      <PageHeading
        title="Bağınızın işini peşəkara həvalə edin"
        subtitle={`Dizayndan gündəlik qulluğa — Azərbaycanda ${formatNumber(platformServiceTotal)} xidmət elanı`}
      />

      {/* "Xidmət axtarışı" */}
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

      {/* "Xidmət kateqoriyaları" — toggles `kateqoriya` */}
      <div role="group" aria-label="Xidmət kateqoriyaları" className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
        {serviceCategories.map((c) => {
          const active = query.categoryId === c.id
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

      {/* "Xidmət filtrləri" */}
      <div className="flex w-full flex-col gap-3.5">
        <div role="tablist" aria-label="Xidmət göstərən növü" className="flex w-full flex-wrap items-start gap-2">
          {providerTabs.map((t) => {
            const active = query.tab === t.value
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="xidmet-elanlari"
                onClick={() => update({ nov: t.value === 'all' ? undefined : t.value })}
                className={cn(
                  'min-h-11 rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap transition-colors',
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
            {formatNumber(result.displayTotal)} xidmət elanı
          </p>
          <SortSelect value={query.sort} onChange={(sort: ServiceSort) => update({ siralama: sort === 'newest' ? undefined : sort })} />
        </div>
      </div>

      {/* "Xidmət elanları" */}
      <div ref={resultsRef} id="xidmet-elanlari" role="tabpanel" className="w-full scroll-mt-28">
        {result.items.length ? (
          <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((s) => (
              <ServiceListingCard key={s.id} service={s} />
            ))}
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <EmptyState
              icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
              title="Uyğun elan tapılmadı"
              description="Filtrləri dəyişin və ya başqa açar söz sınayın."
              action={
                <Button fullWidth onClick={clearAll}>
                  Filtrləri təmizlə
                </Button>
              }
            />
          </div>
        )}
      </div>

      {result.items.length > 0 && (
        <Pagination page={result.page} pageCount={result.pageCount} onChange={(p) => update({ sehife: p > 1 ? String(p) : undefined }, { keepPage: true })} />
      )}

      <InfoNotice title="Xidmət qiymətləri necə göstərilir?">
        Başlanğıc qiymət işin həcminə görə dəyişə bilər. Dəqiq təklif üçün xidmət göstərənlə birbaşa əlaqə saxlayın.
      </InfoNotice>
    </PageContent>
  )
}
