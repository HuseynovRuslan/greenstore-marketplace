import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Flag, Search } from 'lucide-react'
import { useMyListings, useSession } from '@/app/store'
import { ListingCard } from '@/components/cards/ListingCard'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { categoryById } from '@/data/categories'
import { listingBySlug } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import { cn } from '@/lib/format'
import { ComplaintDialog } from '@/features/seller/ComplaintDialog'
import { listingComplaintReasons } from '@/features/seller/complaintReasons'
import { Breadcrumb, InfoNotice } from '@/features/seller/ui'
import { ListingGallery } from '@/features/listing/ListingGallery'
import { MobileContactBar, PricePanel, SellerPanel } from '@/features/listing/ListingPanels'
import {
  listingGallery,
  listingMetaLine,
  listingSpecs,
  otherSellerListings,
  shortTitle,
  similarListings,
  statusInfo,
} from '@/features/listing/detail'
import type { Listing } from '@/types'

/**
 * Elan səhifəsi — Figma "Zeytun ağacı · 1440" (4:35352).
 * Public listings are visible to everyone; the signed-in seller can also open their own pending / expired listings
 * (data or "Elan yerləşdir" drafts), which then show a status notice.
 */
export default function ListingDetailPage() {
  const { slug = '' } = useParams()
  const { user } = useSession()
  const { submitted } = useMyListings()

  const fromData = listingBySlug(slug)
  const own = submitted.find((l) => l.slug === slug)
  const candidate = fromData ?? own
  const isOwner = Boolean(candidate && (own || (user?.sellerId && candidate.sellerId === user.sellerId)))
  const listing = candidate && (candidate.status === 'active' || isOwner) ? candidate : undefined

  if (!listing) return <ListingNotFound />
  return <ListingDetail key={listing.id} listing={listing} />
}

function ListingNotFound() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Elan tapılmadı"
        description="Elan silinib və ya ünvan səhvdir."
        action={
          <ButtonLink to="/elanlar" fullWidth>
            Elanlara bax
          </ButtonLink>
        }
      />
    </div>
  )
}

function ListingDetail({ listing }: { listing: Listing }) {
  const seller = sellerById(listing.sellerId)
  const category = categoryById(listing.categoryId)
  const status = statusInfo(listing.status)
  const specs = listingSpecs(listing)
  const others = otherSellerListings(listing)
  const similar = similarListings(listing, others)
  const phone = seller?.phone

  const [revealed, setRevealed] = useState(false)
  const reveal = useCallback(() => setRevealed(true), [])
  const [complaintOpen, setComplaintOpen] = useState(false)
  const closeComplaint = useCallback(() => setComplaintOpen(false), [])

  useEffect(() => {
    const previous = document.title
    document.title = `${listing.title} — GreenStore`
    return () => {
      document.title = previous
    }
  }, [listing.title])

  return (
    <>
      {/* xl top padding = Figma 15 px spacer under the header + 36 px content padding */}
      <div
        className={cn(
          'page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-6 pb-9 md:pt-9 xl:pt-[51px]',
          phone && 'pb-[106px] md:pb-9',
        )}
      >
        <Breadcrumb
          items={[
            { label: 'Ana səhifə', to: '/' },
            { label: 'Məhsullar', to: '/elanlar' },
            ...(category ? [{ label: category.name, to: `/elanlar?kateqoriya=${category.id}` }] : []),
            { label: shortTitle(listing.title) },
          ]}
        />

        {status.notice && (
          <Notice tone={status.notice.tone} title={status.notice.title}>
            {status.notice.text}
          </Notice>
        )}

        <div className="flex flex-wrap items-start gap-2">
          {listing.vip && <Badge tone="vip">VIP</Badge>}
          <Badge tone={status.badge.tone}>{status.badge.label}</Badge>
        </div>

        <SectionHeader as="h1" title={listing.title} subtitle={listingMetaLine(listing)} />

        {/* "Qalereya və satıcı" */}
        <div className="flex w-full flex-col items-start gap-7 xl:flex-row">
          <div className="w-full min-w-0 xl:flex-1">
            <ListingGallery images={listingGallery(listing)} title={listing.title} />
          </div>
          <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:flex xl:w-[358px] xl:shrink-0 xl:flex-col">
            <PricePanel listing={listing} />
            <SellerPanel listing={listing} seller={seller} revealed={revealed} onReveal={reveal} />
          </div>
        </div>

        {/* "Ətraflı məlumat" */}
        <div className="flex w-full flex-col items-start gap-7 xl:flex-row">
          <div className="flex w-full min-w-0 flex-col gap-6 xl:flex-1">
            {specs.length > 0 && (
              <Panel className="w-full">
                <h2 className="w-full text-[23px] leading-[1.35] font-normal text-ink">Xüsusiyyətlər</h2>
                <dl className="grid w-full grid-cols-2 gap-[18px]">
                  {specs.map((s) => (
                    <div key={s.label} className="min-w-0 leading-[1.6] break-words">
                      <dt className="text-xs text-muted">{s.label}</dt>
                      <dd className="text-sm font-semibold text-ink">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            )}
            {listing.description && listing.description.length > 0 && (
              <Panel className="w-full">
                <h2 className="w-full text-[23px] leading-[1.35] font-normal text-ink">Təsvir</h2>
                <div className="flex w-full flex-col gap-[22.5px] text-[15px] leading-[1.5] text-ink">
                  {listing.description.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </Panel>
            )}
          </div>

          {/* "Təhlükəsizlik" */}
          <div className="flex w-full flex-col items-start gap-5 xl:w-[358px] xl:shrink-0">
            <InfoNotice title="Alışdan əvvəl dəqiqləşdirin">
              Bitkinin ölçüsünü, vəziyyətini və çatdırılma şərtlərini satıcı ilə yoxlayın. Şübhəli təkliflərə qarşı diqqətli olun.
            </InfoNotice>
            <Button
              variant="tertiary"
              aria-haspopup="dialog"
              onClick={() => setComplaintOpen(true)}
              icon={<Flag aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
            >
              Elanı şikayət et
            </Button>
            <p className="w-full text-xs leading-[1.5] text-muted">GreenStore elan platformasıdır. Razılaşma alıcı və satıcı arasında edilir.</p>
          </div>
        </div>

        {others.length > 0 && (
          <section aria-labelledby="satici-diger-elanlari" className="flex w-full flex-col items-start gap-7">
            <SectionHeader title={<span id="satici-diger-elanlari">Satıcının digər elanları</span>} />
            <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {others.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section aria-labelledby="oxsar-elanlar" className="flex w-full flex-col items-start gap-7">
            <SectionHeader title={<span id="oxsar-elanlar">Oxşar elanlar</span>} />
            <div className="grid w-full grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
              {similar.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}
      </div>

      {phone && <MobileContactBar phone={phone} revealed={revealed} onReveal={reveal} />}

      <ComplaintDialog open={complaintOpen} onClose={closeComplaint} title="Elanı şikayət et" reasons={listingComplaintReasons} />
    </>
  )
}
