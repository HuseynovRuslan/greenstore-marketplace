import { BadgeCheck, Check, Clock3, MapPin, Search } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ShareButton } from '@/components/ui/ShareButton'
import { cityName } from '@/data/cities'
import { RevealProvider } from '@/features/contact/RevealContext'
import { ordinal } from '@/features/listing/detail'
import { responseLabel, SellerAvatar } from '@/features/listing/SellerSummary'
import { ComplaintButton } from '@/features/seller/ComplaintButton'
import { mapHref, offerLabels } from '@/features/seller/hours'
import { HoursTable, SellerContactButtons } from '@/features/seller/SellerContact'
import { SellerListings } from '@/features/seller/SellerListings'
import { Breadcrumb } from '@/features/seller/ui'
import { ServiceTile } from '@/features/services/ServiceTile'
import { formatNumber } from '@/lib/format'
import type { Seller, Service } from '@/types'

export const sellerCrumbs = (seller: Seller) => [
  { label: 'Ana səhifə', to: '/' },
  { label: 'Satıcılar', to: '/saticilar' },
  { label: seller.name },
]

/** "Satıcı tapılmadı" — shown with HTTP 404. */
export function SellerNotFound() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Satıcı tapılmadı"
        description="Profil silinib və ya ünvan səhvdir. Digər tingçilik və bağ mərkəzlərinə baxın."
        action={
          <ButtonLink href="/saticilar" fullWidth>
            Satıcılara bax
          </ButtonLink>
        }
      />
    </div>
  )
}

const heading = 'text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest'

/**
 * Business page of a nursery, garden centre or landscaping company (Nov 2026): cover and logo, verified mark, kind,
 * member since, reply time, offers; about and terms; the services it publishes; its listings with category tabs,
 * search and sort; and a sticky contact column (call / WhatsApp, Instagram, website, weekly hours with «open now»,
 * address with a map link, share, report). `listingQuery` is the request's query string (tab, search, sort, page).
 */
export default function SellerPage({ seller, listingQuery, services }: { seller: Seller; listingQuery: string; services: Service[] }) {
  const place = seller.address ?? cityName(seller.cityId)
  const facts = [
    seller.kind,
    seller.memberSince ? `${ordinal(seller.memberSince)} ildən GreenStore-da` : undefined,
    `${formatNumber(seller.activeListings)} aktiv elan`,
  ].filter(Boolean)

  return (
    <RevealProvider>
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-4 pt-3 pb-12 md:gap-5 md:pt-5">
        <Breadcrumb items={sellerCrumbs(seller)} />

        <section aria-labelledby="satici-adi" className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="h-[140px] bg-mint md:h-[220px] xl:h-[260px]">
            {seller.coverImage && <img src={seller.coverImage} alt="" className="size-full object-cover" />}
          </div>
          <div className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-end md:justify-between md:px-7 md:pb-6">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:gap-5">
              <div className="-mt-10 w-fit rounded-[20px] bg-surface p-1 md:-mt-12">
                <SellerAvatar name={seller.name} logo={seller.logo} size="lg" />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 md:pb-1">
                <h1 id="satici-adi" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] break-words text-forest md:text-[30px]">
                  {seller.name}
                  {seller.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs leading-[normal] font-semibold tracking-normal text-success">
                      <BadgeCheck aria-hidden size={14} strokeWidth={2.2} />
                      Təsdiqlənib
                    </span>
                  )}
                </h1>
                <p className="text-sm leading-[1.45] text-ink-soft">{facts.join(' · ')}</p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-[1.4] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin aria-hidden size={14} strokeWidth={1.8} />
                    {place}
                  </span>
                  {seller.responseMinutes != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 aria-hidden size={14} strokeWidth={1.8} />
                      {responseLabel(seller.responseMinutes)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <ShareButton title={seller.name} text={`${seller.name} — GreenStore`} className="shrink-0 max-md:w-full" />
          </div>
        </section>

        {/* Phones: contact, then the page, then hours and address. From 1024 px: the page left, both right. */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr]">
          <div className="lg:col-start-2 lg:row-start-1">
            <section aria-labelledby="elaqe" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-col gap-0.5">
                <h2 id="elaqe" className={heading}>
                  Əlaqə
                </h2>
                {seller.contactPerson && <p className="text-sm leading-[1.45] text-ink-soft">{seller.contactPerson}</p>}
              </div>
              <SellerContactButtons seller={seller} />
            </section>

          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            {(seller.about || seller.offers?.length) && (
              <section aria-labelledby="haqqinda" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 md:p-6">
                <h2 id="haqqinda" className={heading}>
                  Haqqında
                </h2>
                {seller.about && <p className="max-w-[70ch] text-[15px] leading-[1.6] text-ink">{seller.about}</p>}
                {seller.terms && <p className="max-w-[70ch] text-sm leading-[1.55] text-ink-soft">{seller.terms}</p>}
                {seller.offers && seller.offers.length > 0 && (
                  <ul aria-label="Təklif edir" className="flex flex-wrap gap-2">
                    {seller.offers.map((o) => (
                      <li key={o} className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-[13px] leading-[normal] font-medium text-forest">
                        <Check aria-hidden size={14} strokeWidth={2.4} />
                        {offerLabels[o]}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {services.length > 0 && (
              <section aria-labelledby="xidmetleri" className="flex flex-col gap-4">
                <h2 id="xidmetleri" className={heading}>
                  Xidmətləri
                </h2>
                <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
                  {services.map((s) => (
                    <ServiceTile key={s.id} service={s} />
                  ))}
                </div>
              </section>
            )}

            <SellerListings seller={seller} initialQuery={listingQuery} />
          </div>

          <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2">
            {seller.hours && seller.hours.length > 0 && (
              <section aria-labelledby="is-saatlari" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
                <h2 id="is-saatlari" className={heading}>
                  İş saatları
                </h2>
                <HoursTable hours={seller.hours} />
              </section>
            )}

            <section aria-labelledby="unvan" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
              <h2 id="unvan" className={heading}>
                Ünvan
              </h2>
              <p className="text-sm leading-[1.5] text-ink">{place}</p>
              {seller.location && (
                <a
                  href={mapHref(seller.location.lat, seller.location.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-forest hover:underline"
                >
                  <MapPin aria-hidden size={16} strokeWidth={1.8} />
                  Xəritədə aç
                </a>
              )}
            </section>

            {seller.verified && (
              <p className="rounded-xl bg-mint p-4 text-[13px] leading-[1.5] text-ink">
                <span className="font-semibold">Təsdiqlənmiş satıcı:</span> əlaqə və biznes məlumatları yoxlanılıb. Bitkinin vəziyyətini və alış şərtlərini yenə də yerində dəqiqləşdirin.
              </p>
            )}
            <ComplaintButton kind="seller" targetId={seller.id} appearance="link" />
          </div>
        </div>
      </div>
    </RevealProvider>
  )
}
