'use client'

import { useRouter } from 'next/navigation'
import { ArrowDownUp } from 'lucide-react'
import { Listbox } from '@/components/ui/Listbox'
import { CatalogSearchCard } from '@/features/search/CatalogSearchCard'
import { serviceHref, serviceSortOptions, type ServiceSort } from './query'

/** The catalogue's search card on /xidmetler: word and area, «Axtar». */
export function ServiceSearchCard({ query, q, cityId }: { query: string; q: string; cityId?: string }) {
  const router = useRouter()
  return (
    <CatalogSearchCard
      q={q}
      cityIds={cityId ? [cityId] : []}
      query={query}
      action="/xidmetler"
      label="Xidmət axtarışı"
      placeholder="Məsələn, çim salınması"
      onSearch={(word, cities) => router.push(serviceHref(query, { q: word || undefined, erazi: cities[0] }))}
    />
  )
}

/** Sort as the catalogue's Listbox; changing it navigates (the list is server-rendered). */
export function ServiceSort({ query, value }: { query: string; value: ServiceSort }) {
  const router = useRouter()
  return (
    <div className="h-11 w-[200px] shrink-0 rounded-lg border border-line bg-surface max-sm:w-full">
      <Listbox
        label="Sıralama"
        className="h-full"
        align="end"
        value={value}
        onChange={(v) => router.push(serviceHref(query, { siralama: v === 'newest' ? undefined : v }), { scroll: false })}
        options={serviceSortOptions.map((o) => ({ value: o.value, label: o.label }))}
        icon={<ArrowDownUp aria-hidden size={16} strokeWidth={1.8} className="shrink-0 text-muted" />}
        triggerClassName="h-full text-sm"
      />
    </div>
  )
}
