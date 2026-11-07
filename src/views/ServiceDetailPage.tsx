import type { ReactNode } from 'react'
import Link from 'next/link'
import { BadgeCheck, Check, ChevronRight, Clock3, MapPin, ShieldAlert } from 'lucide-react'
import { StickyAside } from '@/components/layout/StickyAside'
import { ShareButton } from '@/components/ui/ShareButton'
import { portfolio, serviceCategories, serviceDetails } from '@/data/services'
import { RevealProvider } from '@/features/contact/RevealContext'
import { Gallery } from '@/features/listing/Gallery'
import { FavoriteToggle } from '@/features/listing/ListingContact'
import { SellerAvatar } from '@/features/listing/SellerSummary'
import { ComplaintButton } from '@/features/seller/ComplaintButton'
import { Breadcrumb } from '@/features/seller/ui'
import { providerContact } from '@/features/services/contact'
import { Portfolio } from '@/features/services/Portfolio'
import { ServiceContact } from '@/features/services/ServiceContact'
import { ServiceTile } from '@/features/services/ServiceTile'
import { cn } from '@/lib/format'
import type { Service, ServiceProvider } from '@/types'

export function serviceCrumbs(service: Service) {
  const category = serviceCategories.find((c) => c.id === service.categoryId)
  return [
    { label: 'Ana səhifə', to: '/' },
    { label: 'Xidmətlər', to: '/xidmetler' },
    ...(category ? [{ label: category.name, to: `/xidmetler?kateqoriya=${category.id}` }] : []),
  ]
}

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

interface ServiceDetailProps {
  service: Service
  provider?: ServiceProvider
  /** The provider's other services */
  others: Service[]
  /** Same kind of work by other providers */
  similar: Service[]
}

/**
 * Service page (Nov 2026), on the listing page's layout: gallery, a sticky summary (title, provider, starting price,
 * «Usta çağır», number and WhatsApp, favourite and share, provider card, a payment note), the work and what it
 * includes, areas and the process, completed projects, the listing facts with «Xidmətdən şikayət et», the provider's
 * other services and similar ones. Phones get «Usta çağır» and «Zəng et» in a bar above the bottom navigation.
 */
export default function ServiceDetailPage({ service, provider, others, similar }: ServiceDetailProps) {
  const contact = providerContact(provider)
  const details = serviceDetails[service.id]
  const priceNote =
    details?.priceNote ?? (service.priceFrom != null ? 'Başlanğıc qiymət: yekun təklif işin həcminə görə verilir.' : 'Qiymət işə baxandan sonra razılaşdırılır.')
  const who = provider ? { id: provider.id, name: provider.name } : { id: service.providerId, name: 'Usta' }

  return (
    <RevealProvider>
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-4 pt-3 pb-12 md:gap-5 md:pt-5">
        <Breadcrumb items={[...serviceCrumbs(service), { label: service.title }]} />

        <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <Gallery images={service.images.length ? service.images : [service.cover]} title={service.title} className="lg:col-start-1 lg:row-start-1" />

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <StickyAside label="Qiymət və əlaqə">
              <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] break-words text-forest md:text-[26px]">{service.title}</h1>
                  <p className="flex items-center gap-1.5 text-sm leading-[1.4] text-muted">
                    <MapPin aria-hidden size={15} strokeWidth={1.8} className="shrink-0" />
                    {service.areas.join(', ')}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[30px] leading-[1.15] font-bold tracking-[-0.01em] text-forest">{service.priceLabel}</p>
                  <p className="text-[13px] leading-[1.5] text-ink-soft">{priceNote}</p>
                </div>
                <div className="max-md:hidden">
                  <ServiceContact phone={contact.phone} title={service.title} provider={who} serviceId={service.id} categoryId={service.categoryId} />
                </div>
                <div className="flex gap-2.5">
                  <FavoriteToggle id={service.id} kind="service" />
                  <ShareButton title={service.title} iconOnly />
                </div>
              </div>

              {provider && (
                <section aria-label="Xidmət göstərən" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <SellerAvatar name={provider.name} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="flex items-center gap-1.5 text-[15px] leading-[1.35] font-semibold text-ink">
                        {provider.name}
                        {provider.verified && <BadgeCheck aria-label={contact.badge ?? 'Təsdiqlənmiş'} role="img" size={17} strokeWidth={2} className="shrink-0 text-success" />}
                      </p>
                      {contact.summary && <p className="text-[13px] leading-[1.4] text-muted">{contact.summary}</p>}
                    </div>
                  </div>
                  {contact.hours && (
                    <p className="flex items-center gap-2 text-[13px] leading-[1.4] text-ink-soft">
                      <Clock3 aria-hidden size={15} strokeWidth={1.8} className="shrink-0 text-forest" />
                      {contact.hours}
                    </p>
                  )}
                  {contact.sellerSlug && (
                    <Link href={`/saticilar/${contact.sellerSlug}`} className="-mx-1 flex min-h-11 items-center justify-between rounded-lg px-1 text-sm font-semibold text-forest hover:text-olive-text">
                      Səhifəsinə bax
                      <ChevronRight aria-hidden size={18} strokeWidth={2} />
                    </Link>
                  )}
                </section>
              )}

              <div className="flex gap-3 rounded-xl bg-sand p-4 text-[13px] leading-[1.5] text-ink">
                <ShieldAlert aria-hidden size={20} strokeWidth={1.8} className="shrink-0 text-forest" />
                <p>
                  <span className="font-semibold">Ödənişi iş bitəndən sonra edin.</span> Həcmi, materialları, müddəti və zəmanəti əvvəlcədən yazılı razılaşdırın.
                </p>
              </div>
            </StickyAside>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2">
            {Boolean(service.description?.length || service.includes?.length) && (
              <Section title="Xidmət haqqında" id="haqqinda">
                {service.description?.map((text) => (
                  <p key={text} className="max-w-[68ch] text-[15px] leading-[1.6] text-ink">
                    {text}
                  </p>
                ))}
                {service.includes?.length ? (
                  <ul className="grid grid-cols-1 gap-2.5 text-sm leading-[1.5] text-ink md:grid-cols-2">
                    {service.includes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check aria-hidden size={16} strokeWidth={2.4} className="mt-0.5 shrink-0 text-success" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            )}

            <Section title={details?.process ? 'Ərazilər və iş qaydası' : 'Xidmət əraziləri'} id="eraziler">
              <ul aria-label="Xidmət əraziləri" className="flex flex-wrap gap-2">
                {service.areas.map((area) => (
                  <li key={area} className="rounded-full bg-mint px-3 py-1.5 text-[13px] leading-[normal] font-medium text-forest">
                    {area}
                  </li>
                ))}
              </ul>
              {details?.process && (
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm leading-[1.5] text-ink-soft">
                  {details.process
                    .split('.')[0]
                    .split('→')
                    .map((stepText, i, all) => (
                      <li key={stepText} className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">{i + 1}</span>
                        {stepText.trim()}
                        {i < all.length - 1 && <ChevronRight aria-hidden size={14} className="text-muted" />}
                      </li>
                    ))}
                </ol>
              )}
            </Section>

            <Portfolio projects={portfolio[service.id] ?? []} />

            <div className="flex flex-col gap-1 px-1 text-[13px] leading-[1.5] text-muted md:flex-row md:items-center md:justify-between">
              {service.number != null ? <p>Elan № {service.number}</p> : <span />}
              <ComplaintButton kind="service" targetId={service.id} appearance="link" />
            </div>
          </div>
        </div>

        {others.length > 0 && (
          <section aria-labelledby="diger-xidmetler" className="mt-6 flex flex-col gap-4">
            <h2 id="diger-xidmetler" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px]">
              {provider?.name ?? 'Ustanın'} — digər xidmətlər
            </h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {others.map((s) => (
                <li key={s.id} className="flex">
                  <ServiceTile service={s} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {similar.length > 0 && (
          <section aria-labelledby="oxsar-xidmetler" className="mt-6 flex flex-col gap-4">
            <h2 id="oxsar-xidmetler" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px]">
              Oxşar xidmətlər
            </h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
              {similar.map((s) => (
                <li key={s.id} className="flex">
                  <ServiceTile service={s} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div
        role="region"
        aria-label="Usta ilə əlaqə"
        // No backdrop-filter here: it would make the bar the containing block of the request dialog (position: fixed).
        className="sticky bottom-[calc(86px+env(safe-area-inset-bottom,0px))] z-30 flex w-full items-center gap-3 border-t border-line bg-surface px-5 py-2.5 md:hidden"
      >
        <ServiceContact phone={contact.phone} title={service.title} provider={who} serviceId={service.id} categoryId={service.categoryId} layout="bar" />
      </div>
    </RevealProvider>
  )
}
