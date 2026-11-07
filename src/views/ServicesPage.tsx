import Link from 'next/link'
import { BadgeCheck, Layers, Search, Shovel, Sprout, Trees, Droplets, Scissors, Fence } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PaginationLinks } from '@/components/ui/PaginationLinks'
import { cityName } from '@/data/cities'
import { serviceCategories, services } from '@/data/services'
import { Breadcrumb } from '@/features/seller/ui'
import { optionClass } from '@/features/search/filterStyles'
import { RequestButton } from '@/features/services/RequestDialog'
import { ServiceSearchCard, ServiceSort } from '@/features/services/ServiceCatalogControls'
import { ServiceTile } from '@/features/services/ServiceTile'
import { filterServices, providerTabs, serviceHref, type ServiceQuery } from '@/features/services/query'
import { cn, formatNumber } from '@/lib/format'
import type { ServiceSearchResult } from '@/services/repository'

export const servicesCrumbs = [{ label: 'Ana səhifə', to: '/' }, { label: 'Bağ xidmətləri' }]

const categoryIcons: Record<string, typeof Trees> = {
  'landsaft-dizayni': Layers,
  'heyetyani-yasillasdirma': Sprout,
  'agac-ekilmesi': Trees,
  'avtomatik-suvarma': Droplets,
  'cim-salinmasi': Shovel,
  'bag-baximi': Scissors,
}

const pricePresets = [
  { label: '100 ₼-a qədər', min: undefined, max: '100' },
  { label: '100–300 ₼', min: '100', max: '300' },
  { label: '300 ₼-dan çox', min: '300', max: undefined },
]

/**
 * /xidmetler (Nov 2026): the services catalogue on the product catalogue's model — the same search card, a sidebar
 * of categories with icons and counts, provider type and starting price (links, so it works without JavaScript),
 * the card language of /elanlar, sort, pagination, empty state, and «Usta çağır» for a request to every provider of
 * a category. Phones get the categories as a chip row and the other filters under them.
 */
export default function ServicesPage({ query, parsed, result }: { query: string; parsed: ServiceQuery; result: ServiceSearchResult }) {
  const countFor = (categoryId?: string) => filterServices(services, { ...parsed, categoryId }).length
  const heading = parsed.categoryId ? (serviceCategories.find((c) => c.id === parsed.categoryId)?.name ?? 'Bağ xidmətləri') : 'Bağ xidmətləri'
  const presetOn = (p: (typeof pricePresets)[number]) => String(parsed.minPrice ?? '') === (p.min ?? '') && String(parsed.maxPrice ?? '') === (p.max ?? '')

  const categoryLinks = [{ id: undefined as string | undefined, name: 'Hamısı' }, ...serviceCategories].map((c) => {
    const active = parsed.categoryId === c.id
    const Icon = c.id ? categoryIcons[c.id] : Fence
    // «Hamısı» says the same number as the heading («95 xidmət»), not only the services loaded here.
    return { ...c, active, Icon, count: c.id ? countFor(c.id) : Math.max(countFor(undefined), parsed.categoryId ? 0 : result.displayTotal), href: serviceHref(query, { kateqoriya: c.id }) }
  })

  const otherFilters = (
    <>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold text-ink">Kim göstərir</legend>
        <div className="flex flex-wrap gap-2">
          {providerTabs.map((t) => (
            <Link
              key={t.value}
              href={serviceHref(query, { nov: t.value === 'all' ? undefined : t.value })}
              scroll={false}
              aria-current={parsed.tab === t.value ? 'page' : undefined}
              className={cn(optionClass(parsed.tab === t.value), 'inline-flex items-center gap-1.5 pointer-coarse:h-11')}
            >
              {t.value === 'sirketler' && <BadgeCheck aria-hidden size={15} strokeWidth={2} />}
              {t.label}
            </Link>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold text-ink">Başlanğıc qiymət</legend>
        <div className="flex flex-wrap gap-2">
          {pricePresets.map((p) => {
            const on = presetOn(p)
            return (
              <Link
                key={p.label}
                href={serviceHref(query, on ? { min: undefined, max: undefined } : { min: p.min, max: p.max })}
                scroll={false}
                aria-current={on ? 'page' : undefined}
                className={cn(optionClass(on), 'inline-flex items-center pointer-coarse:h-11')}
              >
                {p.label}
              </Link>
            )
          })}
        </div>
      </fieldset>
    </>
  )

  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-4 pt-4 pb-14 md:gap-5 md:pt-5">
      <Breadcrumb items={servicesCrumbs} />
      <ServiceSearchCard query={query} q={parsed.q} cityId={parsed.cityId} />

      <div className="mt-1 flex w-full items-start gap-8 md:mt-2">
        <aside aria-label="Filtrlər" className="hidden w-[256px] shrink-0 flex-col gap-7 xl:flex">
          <nav aria-label="Xidmət növləri" className="flex flex-col gap-1">
            <p className="mb-1.5 text-sm font-semibold text-ink">Xidmət növü</p>
            {categoryLinks.map((c) => (
              <Link
                key={c.id ?? 'all'}
                href={c.href}
                scroll={false}
                aria-current={c.active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm leading-[1.3] transition-colors duration-(--dur-fast)',
                  c.active ? 'bg-mint font-semibold text-forest' : 'text-ink hover:bg-mint/60',
                )}
              >
                <c.Icon aria-hidden size={18} strokeWidth={1.8} className="shrink-0 text-forest" />
                <span className="min-w-0 flex-1">{c.name}</span>
                <span className="text-xs text-muted tabular-nums">{formatNumber(c.count)}</span>
              </Link>
            ))}
          </nav>
          {otherFilters}
        </aside>

        <section id="xidmet-elanlari" aria-labelledby="xidmetler-basliq" className="flex min-w-0 flex-1 scroll-mt-28 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 id="xidmetler-basliq" className="text-[22px] leading-[1.25] font-semibold break-words text-forest md:text-[28px]">
                {heading}
                {parsed.cityId && <span className="font-normal text-muted"> · {cityName(parsed.cityId)}</span>}
              </h1>
              <p className="text-[15px] leading-[normal] whitespace-nowrap text-muted tabular-nums">{formatNumber(result.displayTotal)} xidmət</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <ServiceSort query={query} value={parsed.sort} />
              <RequestButton categoryId={parsed.categoryId} className="max-sm:hidden" />
            </div>
          </div>

          {/* < 1280 px: categories as a chip row, the other filters under it. */}
          <div className="flex flex-col gap-4 xl:hidden">
            <nav aria-label="Xidmət növləri" className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-7 md:px-7">
              {categoryLinks.map((c) => (
                <Link key={c.id ?? 'all'} href={c.href} scroll={false} aria-current={c.active ? 'page' : undefined} className={cn(optionClass(c.active), 'inline-flex shrink-0 items-center gap-1.5 pointer-coarse:h-11')}>
                  {c.name}
                  <span className={cn('tabular-nums', c.active ? 'text-white/80' : 'text-muted')}>{c.count}</span>
                </Link>
              ))}
            </nav>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{otherFilters}</div>
          </div>

          {result.items.length ? (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {result.items.map((s) => (
                <li key={s.id} className="flex">
                  <ServiceTile service={s} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex justify-center py-4">
              <EmptyState
                icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
                title="Bu seçimlə xidmət tapılmadı"
                description="Filtrləri azaldın və ya «Usta çağır» ilə sorğu göndərin: uyğun ustalar özləri zəng edəcək."
                action={
                  <ButtonLink href="/xidmetler" fullWidth>
                    Filtrləri təmizlə
                  </ButtonLink>
                }
              />
            </div>
          )}

          {result.items.length > 0 && result.pageCount > 1 && (
            <PaginationLinks page={result.page} pageCount={result.pageCount} basePath="/xidmetler" query={query} scrollTargetId="xidmet-elanlari" />
          )}

          <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-sand p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex flex-col gap-1">
              <p className="text-[17px] leading-[1.3] font-semibold text-forest">Uyğun usta tapmadınız?</p>
              <p className="max-w-[60ch] text-sm leading-[1.5] text-ink-soft">İşi təsvir edin — həmin xidməti göstərən ustalar sizə zəng etsin. Pulsuzdur.</p>
            </div>
            <RequestButton categoryId={parsed.categoryId} className="shrink-0" />
          </div>
          <p className="text-xs leading-[1.5] text-muted">Başlanğıc qiymət işin həcminə görə dəyişir. İşin həcmini, müddətini və zəmanəti ustalarla yazılı razılaşdırın.</p>
        </section>
      </div>
    </div>
  )
}
