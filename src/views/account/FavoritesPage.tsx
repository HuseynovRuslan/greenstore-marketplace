'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useFavorites, useSession } from '@/state/store'
import { ListingCard } from '@/components/cards/ListingCard'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { listingsByIds } from '@/data/listings'
import { serviceById } from '@/data/services'
import { formatNumber } from '@/lib/format'
import { AccountTabs } from '@/features/account/AccountTabs'
import { AccountPage } from '@/features/account/ui'
import { pillClass } from '@/features/account/pill'
import { SavedServiceCard } from '@/features/account/favorites/SavedServiceCard'
import type { Service } from '@/types'

type Kind = 'all' | 'listings' | 'services'

/**
 * Figma "Seçilmişlər · 390" (/secilmisler), adapted to tablet/desktop with the cabinet tabs.
 * Works for guests (their own local list) and for the signed-in account (seeded with the five Figma items).
 * Most recently saved items come first, as in the frame.
 */
export default function FavoritesPage() {
  const { user } = useSession()
  const { favoriteIds } = useFavorites()
  const [kind, setKind] = useState<Kind>('all')

  const savedListings = listingsByIds([...favoriteIds('listing')].reverse())
  const savedServices = [...favoriteIds('service')]
    .reverse()
    .map((id) => serviceById(id))
    .filter((s): s is Service => Boolean(s))
  const total = savedListings.length + savedServices.length

  const tabs: Array<{ value: Kind; label: string; count: number }> = [
    { value: 'all', label: 'Hamısı', count: total },
    { value: 'listings', label: 'Məhsullar', count: savedListings.length },
    { value: 'services', label: 'Xidmətlər', count: savedServices.length },
  ]
  const showListings = kind !== 'services' && savedListings.length > 0
  const showServices = kind !== 'listings' && savedServices.length > 0

  return (
    <AccountPage>
      <SectionHeader
        as="h1"
        title="Seçilmişlər"
        subtitle={`Bəyəndiyiniz elanlara bir yerdən baxın. ${formatNumber(total)} saxlanmış elan.`}
        className="[&_p]:leading-[1.6] md:[&_p]:leading-[1.43]"
      />
      {user && <AccountTabs active="favorites" />}

      <div role="group" aria-label="Seçilmişlərin növü" className="flex w-full flex-wrap items-start gap-2">
        {tabs.map((t) => (
          <button key={t.value} type="button" aria-pressed={kind === t.value} onClick={() => setKind(t.value)} className={pillClass(kind === t.value)}>
            {t.label} · {formatNumber(t.count)}
          </button>
        ))}
      </div>

      {!showListings && !showServices ? (
        <EmptyState
          icon={<Heart aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
          title="Seçilmişlər hələ boşdur"
          description="Bəyəndiyiniz elanda ürək işarəsinə toxunun."
          action={
            <ButtonLink href={kind === 'services' ? '/xidmetler' : '/elanlar'} fullWidth>
              Elanlara bax
            </ButtonLink>
          }
        />
      ) : (
        <>
          {showListings && (
            <section aria-label="Saxlanmış məhsullar" className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {savedListings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </section>
          )}

          {showServices && (
            <section aria-labelledby="saved-services-title" className="flex w-full flex-col items-start gap-7">
              <h2 id="saved-services-title" className="text-[23px] leading-[1.35] font-normal text-ink">
                {savedServices.length > 1 ? 'Saxlanmış xidmətlər' : 'Saxlanmış xidmət'}
              </h2>
              <div className="grid w-full grid-cols-1 items-start gap-3 md:gap-5 xl:grid-cols-3">
                {savedServices.map((s) => (
                  <SavedServiceCard key={s.id} service={s} />
                ))}
              </div>
            </section>
          )}

          <p className="w-full text-[13px] leading-[1.5] text-muted">
            Qiymət və mövcudluq dəyişə bilər. Elanın son məlumatlarını satıcı ilə dəqiqləşdirin.
          </p>
        </>
      )}
    </AccountPage>
  )
}
