'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bookmark, ChevronRight, Heart, Trash2 } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { listingsByIds } from '@/data/listings'
import { serviceById } from '@/data/services'
import { SavedServiceCard } from '@/features/account/favorites/SavedServiceCard'
import { CabinetHeader } from '@/features/cabinet/CabinetHeader'
import { useSavedSearches } from '@/features/saved-searches/useSavedSearches'
import { optionClass } from '@/features/search/filterStyles'
import { cn, formatNumber } from '@/lib/format'
import { useFavorites, useSession } from '@/state/store'
import type { Listing, Service } from '@/types'

type Kind = 'all' | 'listings' | 'services'

/** A saved listing that is no longer for sale (expired, sold, removed): greyed, with its own «Sil». */
function UnavailableCard({ listing, onRemove }: { listing: Listing; onRemove: () => void }) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none opacity-45 grayscale">
        <ListingCard listing={listing} />
      </div>
      <div className="absolute inset-x-2 top-2 flex flex-col gap-2 rounded-lg bg-surface/95 p-3 shadow-sm md:inset-x-3 md:top-3">
        <p className="text-[13px] leading-[1.4] font-semibold text-ink">«{listing.title}» artıq satışda deyil</p>
        <button type="button" onClick={onRemove} className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-semibold text-danger hover:underline">
          <Trash2 aria-hidden size={14} strokeWidth={2} />
          Seçilmişlərdən sil
        </button>
      </div>
    </div>
  )
}

/**
 * /secilmisler — saved listings and services (newest saved first), filter by kind, the saved searches as a strip
 * (signed in), and a note for guests that the list lives in this browser. Listings that are no longer for sale stay
 * visible, greyed, so the visitor knows what happened to them.
 */
export default function FavoritesPage() {
  const { user } = useSession()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { searches } = useSavedSearches(user)
  const [kind, setKind] = useState<Kind>('all')

  const savedListings = listingsByIds([...favoriteIds('listing')].reverse())
  const savedServices = [...favoriteIds('service')]
    .reverse()
    .map((id) => serviceById(id))
    .filter((s): s is Service => Boolean(s))
  const total = savedListings.length + savedServices.length

  const kinds: Array<{ value: Kind; label: string; count: number }> = [
    { value: 'all', label: 'Hamısı', count: total },
    { value: 'listings', label: 'Məhsullar', count: savedListings.length },
    { value: 'services', label: 'Xidmətlər', count: savedServices.length },
  ]
  const showListings = kind !== 'services' && savedListings.length > 0
  const showServices = kind !== 'listings' && savedServices.length > 0

  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-14 md:pt-8">
      {user ? (
        <CabinetHeader active="favorites" counts={{ favorites: total, searches: searches.length }} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest md:text-[30px]">Seçilmişlər</h1>
          <p className="text-[15px] leading-[1.5] text-ink-soft">
            Siyahı bu brauzerdə saxlanılır.{' '}
            <Link href="/daxil-ol?next=%2Fsecilmisler" className="font-semibold text-forest underline-offset-2 hover:underline">
              Daxil olun
            </Link>{' '}
            ki, bütün cihazlarınızda görünsün.
          </p>
        </div>
      )}

      {user && searches.length > 0 && (
        <section aria-labelledby="axtarislar" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="axtarislar" className="flex items-center gap-2 text-[15px] leading-[1.35] font-semibold text-forest">
              <Bookmark aria-hidden size={16} strokeWidth={2} />
              Yadda saxlanılan axtarışlar
            </h2>
            <Link href="/kabinet/axtarislar" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-forest hover:text-olive-text">
              İdarə et
              <ChevronRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          </div>
          <ul className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
            {searches.map((s) => (
              <li key={s.id} className="shrink-0">
                <Link href={`/elanlar${s.query ? `?${s.query}` : ''}`} className={cn(optionClass(false), 'inline-flex items-center gap-2 pointer-coarse:h-11')}>
                  {s.name}
                  {s.newCount ? <span className="rounded-full bg-forest px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums">{s.newCount}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Filters only once there is something to filter: three «0» pills above an empty state are noise. */}
      {total > 0 && (
        <div role="group" aria-label="Seçilmişlərin növü" className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)} className={cn(optionClass(kind === k.value), 'inline-flex items-center gap-1.5 pointer-coarse:h-11')}>
              {k.label}
              <span className={cn('tabular-nums', kind === k.value ? 'text-white/80' : 'text-muted')}>{formatNumber(k.count)}</span>
            </button>
          ))}
        </div>
      )}

      {!showListings && !showServices ? (
        <div className="flex justify-center py-4">
          <EmptyState
            icon={<Heart aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
            title={kind === 'services' ? 'Seçilmiş xidmət yoxdur' : 'Seçilmişlər hələ boşdur'}
            description="Bəyəndiyiniz elanda ürək işarəsinə toxunun: qiymət və satıcı burada əlinizin altında olacaq."
            action={
              <ButtonLink href={kind === 'services' ? '/xidmetler' : '/elanlar'} fullWidth>
                {kind === 'services' ? 'Xidmətlərə bax' : 'Elanlara bax'}
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <>
          {showListings && (
            <section aria-label="Seçilmiş məhsullar">
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
                {savedListings.map((l) => (
                  <li key={l.id} className="flex">
                    {l.status === 'active' ? <ListingCard listing={l} /> : <UnavailableCard listing={l} onRemove={() => toggleFavorite('listing', l.id)} />}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showServices && (
            <section aria-labelledby="secilmis-xidmetler" className="flex flex-col gap-4">
              <h2 id="secilmis-xidmetler" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest">
                Xidmətlər
              </h2>
              <div className="grid grid-cols-1 items-start gap-3 md:gap-5 xl:grid-cols-3">
                {savedServices.map((s) => (
                  <SavedServiceCard key={s.id} service={s} />
                ))}
              </div>
            </section>
          )}

          <p className="text-[13px] leading-[1.5] text-muted">Qiymət və mövcudluq dəyişə bilər: son məlumatı satıcı ilə dəqiqləşdirin.</p>
        </>
      )}
    </div>
  )
}
