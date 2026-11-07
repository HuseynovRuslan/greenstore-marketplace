import type { ReactNode } from 'react'
import Link from 'next/link'
import { CalendarDays, Droplets, MapPin, PackageCheck, Search, ShieldAlert, Shovel, Sprout, Sun, Snowflake, Truck } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { StickyAside } from '@/components/layout/StickyAside'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Notice } from '@/components/ui/Notice'
import { PromotedBadge } from '@/components/ui/PromotedBadge'
import { ShareButton } from '@/components/ui/ShareButton'
import { RevealProvider } from '@/features/contact/RevealContext'
import { ComplaintButton } from '@/features/seller/ComplaintButton'
import { Breadcrumb } from '@/features/seller/ui'
import { Gallery } from '@/features/listing/Gallery'
import { narrowCardImages, withCardImage } from '@/features/listing/cardImages'
import { ContactButtons, FavoriteToggle, MobileContactBar, type ContactInfo } from '@/features/listing/ListingContact'
import { SellerSummary } from '@/features/listing/SellerSummary'
import { OwnerStrip } from '@/features/listing/OwnerStrip'
import { listingGallery, shortTitle, statusInfo } from '@/features/listing/detail'
import { careItems, factRows, listingPrice, placeLabel, stockLabel, wholesaleLabel, type CareItem } from '@/features/listing/facts'
import { cn, formatFullDate, formatNumber } from '@/lib/format'
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
        description="Elan satılıb, silinib və ya müddəti bitib. Oxşar bitkiləri axtarışda tapa bilərsiniz."
        action={
          <ButtonLink href="/elanlar" fullWidth>
            Elanlara bax
          </ButtonLink>
        }
      />
    </div>
  )
}

/** Section of the listing page: a white panel with a semibold forest heading (Variant 2). */
function Section({ title, id, children, className }: { title: string; id: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 md:p-6', className)}>
      <h2 id={id} className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest">
        {title}
      </h2>
      {children}
    </section>
  )
}

const careIcons: Record<CareItem['key'], typeof Sun> = { sun: Sun, water: Droplets, frost: Snowflake, planting: CalendarDays }

interface ListingDetailProps {
  listing: Listing
  seller?: Seller
  category?: Category
  /** «Satıcının digər elanları» */
  others: Listing[]
  /** «Oxşar elanlar» */
  similar: Listing[]
  /**
   * `public` (the page), `owner` (the seller's own unpublished listing: a status notice on top) or `preview` (the
   * posting flow's last step: no breadcrumb, related lists or report; contact and favourite look real but are inert).
   */
  mode?: 'public' | 'owner' | 'preview'
}

/**
 * Listing page (Nov 2026). Gallery left, a sticky summary right (title, place, price with unit, wholesale and
 * stock, delivery / planting, contact, favourite and share, seller, safety); below the gallery the attributes,
 * care, description and the listing facts (ID, dates, views, report); then the seller's other listings and similar
 * ones. Phones: gallery edge to edge, the summary under it, and a contact bar above the bottom navigation.
 * Server-rendered; the gallery, contact, favourite, share and report are client islands.
 */
export function ListingDetail({ listing, seller, category, others, similar, mode = 'public' }: ListingDetailProps) {
  const preview = mode === 'preview'
  const status = statusInfo(listing.status)
  const price = listingPrice(listing)
  const wholesale = wholesaleLabel(listing)
  const stock = stockLabel(listing)
  const facts = factRows(listing)
  const care = careItems(listing.plant)
  const contact: ContactInfo = {
    listingId: listing.id,
    title: listing.title,
    phone: listing.contactPhone ?? seller?.phone,
    whatsapp: listing.whatsapp ?? seller?.whatsapp ?? false,
    phoneHidden: listing.phoneHidden ?? false,
  }
  const delivery = listing.deliveryAvailable || listing.deliveryAreas
  const images = listingGallery(listing)

  return (
    <RevealProvider>
      <div className={cn('page-x mx-auto flex w-full max-w-[1440px] flex-col gap-4 pb-12 md:gap-5', preview ? 'pt-0' : 'pt-3 md:pt-5')}>
        {!preview && <Breadcrumb items={listingCrumbs(listing, category)} />}

        {mode === 'public' && <OwnerStrip sellerId={listing.sellerId} listingId={listing.id} />}

        {mode === 'owner' && status.notice && (
          <Notice tone={status.notice.tone} title={status.notice.title}>
            {listing.status === 'rejected' && listing.rejectionReason ? listing.rejectionReason : status.notice.text}
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <Gallery
            images={images}
            title={listing.title}
            badge={listing.vip ? <PromotedBadge /> : undefined}
            className="lg:col-start-1 lg:row-start-1"
          />

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <StickyAside label="Qiymət və əlaqə">
              <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
                {(listing.wholesale || listing.status !== 'active') && (
                  <div className="flex flex-wrap gap-2">
                    {listing.wholesale && <Badge tone="neutral">Topdan satış var</Badge>}
                    {listing.status !== 'active' && <Badge tone={status.badge.tone}>{status.badge.label}</Badge>}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] break-words text-forest md:text-[26px]">{listing.title}</h1>
                  <p className="flex items-center gap-1.5 text-sm leading-[1.4] text-muted">
                    <MapPin aria-hidden size={15} strokeWidth={1.8} className="shrink-0" />
                    {placeLabel(listing)}
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[30px] leading-[1.15] font-bold tracking-[-0.01em] text-forest tabular-nums">{price.amount}</span>
                    {price.unit && <span className="text-[15px] leading-[normal] text-muted">{price.unit}</span>}
                  </p>
                  {price.note && <p className="text-[13px] leading-[1.4] font-medium text-success">{price.note}</p>}
                </div>

                {(wholesale || stock) && (
                  <dl className="grid gap-2 rounded-lg bg-mint px-3.5 py-3 text-sm leading-[1.4]">
                    {wholesale && (
                      <div className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-ink-soft">Topdan qiymət</dt>
                        <dd className="font-semibold text-ink">{wholesale}</dd>
                      </div>
                    )}
                    {stock && (
                      <div className="flex flex-wrap justify-between gap-x-3">
                        <dt className="text-ink-soft">Stokda</dt>
                        <dd className="font-semibold text-ink">{stock}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {(delivery || listing.plantingAvailable) && (
                  <ul className="flex flex-col gap-2 text-sm leading-[1.45] text-ink">
                    {delivery && (
                      <li className="flex gap-2.5">
                        <Truck aria-hidden size={18} strokeWidth={1.8} className="mt-px shrink-0 text-forest" />
                        <span>
                          <span className="font-semibold">Çatdırılma</span>
                          {listing.deliveryAreas ? `: ${listing.deliveryAreas}` : ' var'}
                        </span>
                      </li>
                    )}
                    {listing.plantingAvailable && (
                      <li className="flex gap-2.5">
                        <Shovel aria-hidden size={18} strokeWidth={1.8} className="mt-px shrink-0 text-forest" />
                        <span>
                          <span className="font-semibold">Əkin xidməti</span>: satıcı yerində əkə bilər
                        </span>
                      </li>
                    )}
                  </ul>
                )}

                {/* In the posting preview the buttons look exactly as published but do nothing (inert). */}
                <div inert={preview || undefined} className="max-md:hidden">
                  <ContactButtons info={contact} />
                </div>
                <div inert={preview || undefined} className="flex gap-2.5">
                  <FavoriteToggle id={listing.id} />
                  <ShareButton title={listing.title} iconOnly />
                </div>
              </div>

              <SellerSummary listing={listing} seller={seller} />

              <div className="flex gap-3 rounded-xl bg-sand p-4 text-[13px] leading-[1.5] text-ink">
                <ShieldAlert aria-hidden size={20} strokeWidth={1.8} className="shrink-0 text-forest" />
                <p>
                  <span className="font-semibold">Bitkini görmədən beh göndərməyin.</span> Kök sistemini, yarpaqları və ölçünü yerində yoxlayın, ödənişi sonra edin.{' '}
                  {!preview && (
                    <Link href="/tehlukesiz-alis" className="font-semibold text-forest underline underline-offset-2">
                      Necə yoxlamalı
                    </Link>
                  )}
                </p>
              </div>
            </StickyAside>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2">
            {facts.length > 0 && (
              <Section title="Xüsusiyyətlər" id="xususiyyetler">
                <dl className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                  {facts.map((f) => (
                    <div key={f.label} className="flex justify-between gap-4 border-b border-line py-2.5 text-sm leading-[1.45]">
                      <dt className="shrink-0 text-muted">{f.label}</dt>
                      <dd className={cn('min-w-0 text-right font-semibold break-words text-ink', f.latin && 'font-medium italic')}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}

            {(care.length > 0 || listing.careTips?.length) && (
              <Section title="Qulluq" id="qulluq">
                {care.length > 0 && (
                  <ul className="grid grid-cols-1 gap-2.5 xs:grid-cols-2">
                    {care.map((c) => {
                      const Icon = careIcons[c.key]
                      return (
                        <li key={c.key} className="flex items-start gap-3 rounded-lg bg-cream p-3">
                          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
                            <Icon size={18} strokeWidth={1.8} />
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-xs leading-[1.4] text-muted">{c.label}</span>
                            <span className="text-sm leading-[1.4] font-semibold text-ink">{c.value}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {listing.careTips && listing.careTips.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm leading-[1.4] font-semibold text-ink">Satıcının məsləhəti</h3>
                    <ul className="flex flex-col gap-2 text-sm leading-[1.55] text-ink">
                      {listing.careTips.map((tip, i) => (
                        <li key={i} className="flex gap-2.5">
                          <Sprout aria-hidden size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-olive" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {listing.description && listing.description.length > 0 && (
              <Section title="Təsvir" id="tesvir">
                <div className="flex max-w-[68ch] flex-col gap-3 text-[15px] leading-[1.6] break-words text-ink">
                  {listing.description.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </Section>
            )}

            <div className="flex flex-col gap-1 px-1 text-[13px] leading-[1.5] text-muted md:flex-row md:items-center md:justify-between md:gap-4">
              <p className="flex flex-wrap gap-x-3 gap-y-0.5">
                {listing.number != null && <span>Elan № {listing.number}</span>}
                <span>Yerləşdirilib: {formatFullDate(listing.publishedAt)}</span>
                {listing.updatedAt && <span>Yeniləndi: {formatFullDate(listing.updatedAt)}</span>}
                {listing.views != null && <span>{formatNumber(listing.views)} baxış</span>}
              </p>
              {!preview && <ComplaintButton kind="listing" targetId={listing.id} appearance="link" className="self-start md:self-auto" />}
            </div>
          </div>
        </div>

        {!preview && others.length > 0 && seller && (
          <section aria-labelledby="satici-diger-elanlari" className="mt-6 flex flex-col gap-4 md:gap-5">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <h2 id="satici-diger-elanlari" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px]">
                Satıcının digər elanları
              </h2>
              <Link href={`/saticilar/${seller.slug}`} className="flex h-11 shrink-0 items-center text-sm font-semibold text-forest hover:text-olive-text">
                Hamısı
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {others.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}

        {!preview && similar.length > 0 && (
          <section aria-labelledby="oxsar-elanlar" className="mt-6 flex flex-col gap-4 md:gap-5">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <h2 id="oxsar-elanlar" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px]">
                Oxşar elanlar
              </h2>
              {category && (
                <Link href={categoryPath(category.id)} className="flex h-11 shrink-0 items-center text-sm font-semibold text-forest hover:text-olive-text">
                  {category.name}
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {similar.map((l) => (
                <ListingCard key={l.id} listing={withCardImage(l, narrowCardImages)} />
              ))}
            </div>
          </section>
        )}

        {mode === 'public' && listing.status === 'active' && (
          <p className="flex items-center gap-2 px-1 text-xs leading-[1.5] text-muted">
            <PackageCheck aria-hidden size={14} strokeWidth={1.8} />
            GreenStore elan platformasıdır: razılaşma və ödəniş alıcı ilə satıcı arasında olur.
          </p>
        )}
      </div>

      {!preview && <MobileContactBar info={contact} amount={price.amount} unit={price.unit} />}
    </RevealProvider>
  )
}
