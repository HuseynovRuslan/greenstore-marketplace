import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Flag, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cityName } from '@/data/cities'
import { sellerBySlug } from '@/data/sellers'
import { ComplaintDialog } from '@/features/seller/ComplaintDialog'
import { sellerComplaintReasons } from '@/features/seller/complaintReasons'
import { PhoneReveal, WhatsAppLink } from '@/features/seller/ContactActions'
import { SellerListings } from '@/features/seller/SellerListings'
import { Breadcrumb, InfoNotice } from '@/features/seller/ui'
import type { Seller } from '@/types'

/** Satıcı profili — Figma "Abşeron Tingçilik · 1440" (4:36085). */
export default function SellerPage() {
  const { slug = '' } = useParams()
  const seller = sellerBySlug(slug)
  if (!seller) return <SellerNotFound />
  return <SellerProfile key={seller.id} seller={seller} />
}

function SellerNotFound() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Satıcı tapılmadı"
        description="Satıcı profili silinib və ya ünvan səhvdir."
        action={
          <ButtonLink to="/elanlar" fullWidth>
            Elanlara bax
          </ButtonLink>
        }
      />
    </div>
  )
}

function SellerProfile({ seller }: { seller: Seller }) {
  const [revealed, setRevealed] = useState(false)
  const reveal = useCallback(() => setRevealed(true), [])
  const [complaintOpen, setComplaintOpen] = useState(false)
  const closeComplaint = useCallback(() => setComplaintOpen(false), [])

  const location = seller.address ?? cityName(seller.cityId)
  const subtitle = [seller.kind, location].filter(Boolean).join(' · ')

  useEffect(() => {
    const previous = document.title
    document.title = `${seller.name} — GreenStore`
    return () => {
      document.title = previous
    }
  }, [seller.name])

  return (
    <>
      {/* xl top padding = Figma 15 px spacer under the header + 36 px content padding */}
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-6 pb-9 md:pt-9 xl:pt-[51px]">
        <Breadcrumb
          items={[
            { label: 'Ana səhifə', to: '/' },
            { label: 'Satıcılar', to: '/#saticilar' },
            { label: seller.name },
          ]}
        />

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
          <Panel aria-label="Satıcı ilə əlaqə" className="w-full shrink-0 md:w-[300px] xl:w-[358px]">
            {seller.contactPerson && (
              <p className="w-full text-[15px] leading-[1.5] font-semibold text-ink">Əlaqələndirici şəxs: {seller.contactPerson}</p>
            )}
            <p className="w-full text-sm leading-[1.5] text-ink">{location}</p>
            <PhoneReveal phone={seller.phone} revealed={revealed} onReveal={reveal} />
            <WhatsAppLink phone={seller.phone} />
            {!seller.phone && <p className="-mt-2 w-full text-xs leading-[1.5] text-muted">Satıcının əlaqə nömrəsi göstərilmir.</p>}
            <Button
              variant="tertiary"
              fullWidth
              aria-haspopup="dialog"
              onClick={() => setComplaintOpen(true)}
              icon={<Flag aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
            >
              Satıcını şikayət et
            </Button>
          </Panel>
        </div>

        <SellerListings seller={seller} />

        {seller.verified && (
          <InfoNotice title="Təsdiqlənmiş satıcı nə deməkdir?">
            Satıcının əlaqə və biznes məlumatları yoxlanılıb. Məhsulun vəziyyətini və alış şərtlərini yenə də satıcı ilə dəqiqləşdirin.
          </InfoNotice>
        )}
      </div>

      <ComplaintDialog open={complaintOpen} onClose={closeComplaint} title="Satıcını şikayət et" reasons={sellerComplaintReasons} />
    </>
  )
}
