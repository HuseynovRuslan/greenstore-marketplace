import { Search } from 'lucide-react'
import { InfoNotice } from '@/components/ui/Notice'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cityName } from '@/data/cities'
import { ComplaintButton } from '@/features/seller/ComplaintButton'
import { RevealablePhone, WhatsAppLink } from '@/features/seller/ContactActions'
import { SellerListings } from '@/features/seller/SellerListings'
import { Breadcrumb } from '@/features/seller/ui'
import type { Seller } from '@/types'

export const sellerCrumbs = (seller: Seller) => [
  { label: 'Ana səhifə', to: '/' },
  { label: 'Satıcılar', to: '/#saticilar' },
  { label: seller.name },
]

/** "Satıcı tapılmadı" — shown with HTTP 404. */
export function SellerNotFound() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Satıcı tapılmadı"
        description="Satıcı profili silinib və ya ünvan səhvdir."
        action={
          <ButtonLink href="/elanlar" fullWidth>
            Elanlara bax
          </ButtonLink>
        }
      />
    </div>
  )
}

/**
 * Satıcı profili — Figma "Abşeron Tingçilik · 1440" (4:36085). Server-rendered; phone reveal, complaint dialog and the
 * listing filters are client islands. `listingQuery` is the request's query string (tab, search, sort, page).
 */
export default function SellerPage({ seller, listingQuery }: { seller: Seller; listingQuery: string }) {
  const location = seller.address ?? cityName(seller.cityId)
  const subtitle = [seller.kind, location].filter(Boolean).join(' · ')

  return (
    <>
      {/* xl top padding = Figma 15 px spacer under the header + 36 px content padding */}
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-6 pb-9 md:pt-9 xl:pt-[51px]">
        <Breadcrumb items={sellerCrumbs(seller)} />

        {seller.coverImage && (
          <img
            src={seller.coverImage}
            alt={`${seller.name} — təsərrüfat`}
            className="h-[160px] w-full rounded-lg bg-disabled object-cover md:h-[240px] xl:h-[320px]"
          />
        )}

        {/* "Satıcının ictimai profili" */}
        <div className="flex w-full flex-col items-start gap-7 md:flex-row">
          <div className="flex w-full min-w-0 flex-col items-start gap-5 md:flex-1">
            <SectionHeader as="h1" title={seller.name} subtitle={subtitle} />
            <div className="flex w-full flex-wrap items-start gap-2">
              {seller.verified && <Badge tone="success">Təsdiqlənmiş satıcı</Badge>}
              {seller.memberSince && <Badge tone="neutral">{seller.memberSince}-dən GreenStore-da</Badge>}
              <Badge tone="neutral">{seller.activeListings} aktiv elan</Badge>
            </div>
            {seller.about && <p className="w-full text-[15px] leading-[1.5] text-ink">{seller.about}</p>}
            {seller.terms && <p className="w-full text-sm leading-[1.5] text-muted">{seller.terms}</p>}
          </div>

          {/* "Satıcı ilə əlaqə" */}
          <Panel role="region" aria-label="Satıcı ilə əlaqə" className="w-full shrink-0 md:w-[300px] xl:w-[358px]">
            {seller.contactPerson && (
              <p className="w-full text-[15px] leading-[1.5] font-semibold text-ink">Əlaqələndirici şəxs: {seller.contactPerson}</p>
            )}
            <p className="w-full text-sm leading-[1.5] text-ink">{location}</p>
            <RevealablePhone phone={seller.phone} />
            <WhatsAppLink phone={seller.phone} />
            {!seller.phone && <p className="-mt-2 w-full text-xs leading-[1.5] text-muted">Satıcının əlaqə nömrəsi göstərilmir.</p>}
            <ComplaintButton kind="seller" fullWidth />
          </Panel>
        </div>

        <SellerListings seller={seller} initialQuery={listingQuery} />

        {seller.verified && (
          <InfoNotice title="Təsdiqlənmiş satıcı nə deməkdir?">
            Satıcının əlaqə və biznes məlumatları yoxlanılıb. Məhsulun vəziyyətini və alış şərtlərini yenə də satıcı ilə dəqiqləşdirin.
          </InfoNotice>
        )}
      </div>
    </>
  )
}
