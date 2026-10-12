import { Search } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { InfoNotice, Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealProvider } from '@/features/contact/RevealContext'
import { ComplaintButton } from '@/features/seller/ComplaintButton'
import { Breadcrumb } from '@/features/seller/ui'
import { ListingGallery } from '@/features/listing/ListingGallery'
import { narrowCardImages, wideCardImages, withCardImage } from '@/features/listing/cardImages'
import { MobileContactBar, PricePanel, SellerPanel } from '@/features/listing/ListingPanels'
import { listingGallery, listingMetaLine, listingSpecs, shortTitle, statusInfo } from '@/features/listing/detail'
import { categoryPath } from '@/seo/catalog'
import type { Category, Listing, Seller } from '@/types'

/** Breadcrumb of a listing page (also used for its BreadcrumbList JSON-LD). */
export function listingCrumbs(listing: Listing, category?: Category): Array<{ label: string; to?: string }> {
  return [
    { label: 'Ana səhifə', to: '/' },
    { label: 'Məhsullar', to: '/elanlar' },
    ...(category ? [{ label: category.name, to: categoryPath(category.id) }] : []),
    { label: shortTitle(listing.title) },
  ]
}

/** "Elan tapılmadı" — shown with HTTP 404 for unknown, removed and unpublished listings. */
export function ListingNotFound() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Elan tapılmadı"
        description="Elan silinib və ya ünvan səhvdir."
        action={
          <ButtonLink href="/elanlar" fullWidth>
            Elanlara bax
          </ButtonLink>
        }
      />
    </div>
  )
}

interface ListingDetailProps {
  listing: Listing
  seller?: Seller
  category?: Category
  /** "Satıcının digər elanları" */
  others: Listing[]
  /** "Oxşar elanlar" */
  similar: Listing[]
}

/**
 * Elan səhifəsi — Figma "Zeytun ağacı · 1440" (4:35352).
 * Server-rendered for public listings; the seller's own unpublished listings render the same component in the
 * browser (see src/app/(main)/elanlar/[slug]/not-found.tsx). Interactive parts are client islands: gallery,
 * favourite/share, phone reveal (shared by the panel and the mobile bar), complaint dialog.
 */
export function ListingDetail({ listing, seller, category, others, similar }: ListingDetailProps) {
  const status = statusInfo(listing.status)
  const specs = listingSpecs(listing)
  const phone = seller?.phone

  return (
    <RevealProvider>
      {/* xl top padding = Figma 15 px spacer under the header + 36 px content padding */}
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-6 pb-9 md:pt-9 xl:pt-[51px]">
        <Breadcrumb items={listingCrumbs(listing, category)} />

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
            <SellerPanel listing={listing} seller={seller} />
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
                      <dt className="text-[12px] text-muted">{s.label}</dt>
                      <dd className="text-[14px] font-semibold text-ink">{s.value}</dd>
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
            <ComplaintButton kind="listing" />
            <p className="w-full text-xs leading-[1.5] text-muted">GreenStore elan platformasıdır. Razılaşma alıcı və satıcı arasında edilir.</p>
          </div>
        </div>

        {others.length > 0 && (
          <section aria-labelledby="satici-diger-elanlari" className="flex w-full flex-col items-start gap-7">
            <SectionHeader title={<span id="satici-diger-elanlari">Satıcının digər elanları</span>} />
            <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {others.map((l) => (
                <ListingCard key={l.id} listing={withCardImage(l, wideCardImages)} />
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section aria-labelledby="oxsar-elanlar" className="flex w-full flex-col items-start gap-7">
            <SectionHeader title={<span id="oxsar-elanlar">Oxşar elanlar</span>} />
            <div className="grid w-full grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
              {similar.map((l) => (
                <ListingCard key={l.id} listing={withCardImage(l, narrowCardImages)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {phone && <MobileContactBar phone={phone} />}
    </RevealProvider>
  )
}
