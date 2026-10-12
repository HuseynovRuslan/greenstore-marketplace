import { Badge } from '@/components/ui/Badge'
import { InfoNotice } from '@/components/ui/Notice'
import { portfolio, serviceCategories, serviceDetails } from '@/data/services'
import { RevealProvider } from '@/features/contact/RevealContext'
import { Breadcrumbs, InsetPanel, PageContent, PageHeading } from '@/features/services/ui'
import { ServiceGallery } from '@/features/services/ServiceGallery'
import { MobileContactBar, PricePanel, ProviderPanel } from '@/features/services/ServiceSidebar'
import { Portfolio } from '@/features/services/Portfolio'
import { ServiceComplaint } from '@/features/services/ServiceComplaint'
import { providerContact } from '@/features/services/contact'
import type { Service, ServiceProvider } from '@/types'

export function serviceCrumbs(service: Service) {
  const category = serviceCategories.find((c) => c.id === service.categoryId)
  return [
    { label: 'Ana səhifə', to: '/' },
    { label: 'Xidmətlər', to: '/xidmetler' },
    ...(category ? [{ label: category.name, to: `/xidmetler?kateqoriya=${category.id}` }] : []),
  ]
}

/**
 * Figma "YARPAQ · Landşaft dizaynı · 1440" — works for every service; sections without data are omitted.
 * Server-rendered; gallery, favourite/share, phone reveal, portfolio viewer and complaint are client islands.
 */
export default function ServiceDetailPage({ service, provider }: { service: Service; provider?: ServiceProvider }) {
  const contact = providerContact(provider)
  const details = serviceDetails[service.id]
  const meta = [provider?.name, service.areas.join(', '), service.number && `Elan № ${service.number}`].filter(Boolean).join(' · ')

  return (
    <RevealProvider>
      <PageContent>
        <Breadcrumbs items={serviceCrumbs(service)} />
        {service.verified && <Badge tone="success">Təsdiqlənmiş xidmət göstərən</Badge>}
        <PageHeading title={service.title} subtitle={meta} />

        {/* "Portfolio və xidmət göstərən" */}
        <div className="flex w-full flex-col items-start gap-7 xl:flex-row">
          <ServiceGallery key={service.id} images={service.images} title={service.title} className="w-full xl:flex-1" />
          <div className="grid w-full grid-cols-1 items-start gap-5 md:grid-cols-2 xl:flex xl:w-[358px] xl:shrink-0 xl:flex-col">
            <PricePanel
              service={service}
              note={
                details?.priceNote ??
                (service.priceFrom != null
                  ? 'Başlanğıc qiymət işin həcminə görə dəyişə bilər. Dəqiq təklif üçün xidmət göstərənlə birbaşa əlaqə saxlayın.'
                  : 'Dəqiq təklif üçün xidmət göstərənlə birbaşa əlaqə saxlayın.')
              }
            />
            {provider && <ProviderPanel provider={provider} contact={contact} />}
          </div>
        </div>

        {Boolean(service.description?.length || service.includes?.length) && (
          <InsetPanel className="w-full text-ink">
            <h2 className="w-full text-[23px] leading-[1.35] font-normal">Xidmət haqqında</h2>
            {service.description?.map((text) => (
              <p key={text} className="w-full text-[15px] leading-[1.5]">
                {text}
              </p>
            ))}
            {service.includes?.length ? (
              <ul className="grid w-full grid-cols-1 gap-4 text-sm leading-[1.5] md:grid-cols-2">
                {service.includes.map((item) => (
                  <li key={item}>
                    <span aria-hidden>✓ </span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </InsetPanel>
        )}

        <InsetPanel className="w-full">
          <h2 className="w-full text-[23px] leading-[1.35] font-normal text-ink">{details?.process ? 'Xidmət əraziləri və iş prosesi' : 'Xidmət əraziləri'}</h2>
          <ul className="flex w-full flex-wrap items-start gap-2" aria-label="Xidmət əraziləri">
            {service.areas.map((area) => (
              <li key={area}>
                <Badge tone="neutral">{area}</Badge>
              </li>
            ))}
          </ul>
          {details?.process && <p className="w-full text-sm leading-[1.5] text-muted">{details.process}</p>}
        </InsetPanel>

        <Portfolio projects={portfolio[service.id] ?? []} />

        <InfoNotice title="İşi başlamazdan əvvəl">
          İşin həcmini, materialları, müddəti və zəmanət şərtlərini xidmət göstərənlə yazılı şəkildə razılaşdırın.
        </InfoNotice>

        <ServiceComplaint />

        {provider && <MobileContactBar contact={contact} />}
      </PageContent>
    </RevealProvider>
  )
}
