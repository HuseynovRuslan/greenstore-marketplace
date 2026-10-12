import { useCallback, useState } from 'react'
import { useParams } from 'react-router'
import { Flag } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { portfolio, providerById, serviceBySlug, serviceCategories, serviceDetails } from '@/data/services'
import { Breadcrumbs, InfoNotice, InsetPanel, PageContent, PageHeading } from '@/features/services/ui'
import { ServiceGallery } from '@/features/services/ServiceGallery'
import { MobileContactBar, PricePanel, ProviderPanel } from '@/features/services/ServiceSidebar'
import { ComplaintDialog } from '@/features/services/ComplaintDialog'
import { ImageViewer } from '@/features/services/ImageViewer'
import { providerContact } from '@/features/services/contact'
import NotFoundPage from '@/pages/NotFoundPage'
import type { Service } from '@/types'

/** "Tamamlanmış layihələr": 2-column grid of "Məlumat paneli" cards (photo 270 px, title 15 px semibold, text 13 px muted). */
function Portfolio({ service }: { service: Service }) {
  const projects = portfolio[service.id] ?? []
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const closeViewer = useCallback(() => setViewerIndex(null), [])
  if (!projects.length) return null
  return (
    <section aria-labelledby="tamamlanmis-layiheler" className="flex w-full flex-col gap-7">
      <h2 id="tamamlanmis-layiheler" className="text-[23px] leading-[1.35] font-normal text-ink md:text-[30px]">
        Tamamlanmış layihələr
      </h2>
      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
        {projects.map((p, i) => (
          <InsetPanel
            key={p.title}
            className="relative self-start transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-olive"
          >
            <img src={p.image} alt={p.title} loading="lazy" className="h-[200px] w-full rounded-lg object-cover md:h-[270px]" />
            <h3 className="w-full text-[15px] leading-[23px] font-semibold text-ink">
              <button type="button" onClick={() => setViewerIndex(i)} className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
                {p.title}
              </button>
            </h3>
            <p className="w-full text-[13px] leading-[20px] text-muted">{p.description}</p>
          </InsetPanel>
        ))}
      </div>
      <ImageViewer
        images={projects.map((p) => ({ src: p.image, alt: p.title, title: p.title, description: p.description }))}
        index={viewerIndex}
        onClose={closeViewer}
        label="Tamamlanmış layihələr"
      />
    </section>
  )
}

/** Figma "YARPAQ · Landşaft dizaynı · 1440" — works for every service; sections without data are omitted. */
export default function ServiceDetailPage() {
  const { slug = '' } = useParams()
  const service = serviceBySlug(slug)
  const [revealed, setRevealed] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaintSent, setComplaintSent] = useState(false)
  const [prevSlug, setPrevSlug] = useState(slug)
  if (slug !== prevSlug) {
    setPrevSlug(slug)
    setRevealed(false)
    setComplaintSent(false)
  }
  const closeComplaint = useCallback(() => setComplaintOpen(false), [])

  if (!service) return <NotFoundPage />

  const provider = providerById(service.providerId)
  const contact = providerContact(provider)
  const category = serviceCategories.find((c) => c.id === service.categoryId)
  const details = serviceDetails[service.id]
  const meta = [provider?.name, service.areas.join(', '), service.number && `Elan № ${service.number}`].filter(Boolean).join(' · ')
  const reveal = () => setRevealed(true)

  return (
    <PageContent>
      <Breadcrumbs
        items={[
          { label: 'Ana səhifə', to: '/' },
          { label: 'Xidmətlər', to: '/xidmetler' },
          ...(category ? [{ label: category.name, to: `/xidmetler?kateqoriya=${category.id}` }] : []),
        ]}
      />
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
          {provider && <ProviderPanel provider={provider} contact={contact} revealed={revealed} onReveal={reveal} />}
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

      <Portfolio key={service.id} service={service} />

      <InfoNotice title="İşi başlamazdan əvvəl">
        İşin həcmini, materialları, müddəti və zəmanət şərtlərini xidmət göstərənlə yazılı şəkildə razılaşdırın.
      </InfoNotice>

      <div className="flex w-full flex-col items-start gap-4">
        <Button
          variant="tertiary"
          disabled={complaintSent}
          onClick={() => setComplaintOpen(true)}
          icon={<Flag aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
        >
          Elanı şikayət et
        </Button>
        {complaintSent && (
          <Notice tone="success" title="Şikayətiniz göndərildi" className="max-w-[432px]">
            Nəticə haqqında məlumat veriləcək.
          </Notice>
        )}
      </div>

      <ComplaintDialog
        open={complaintOpen}
        onClose={closeComplaint}
        onSubmitted={() => {
          setComplaintOpen(false)
          setComplaintSent(true)
        }}
      />

      {provider && <MobileContactBar contact={contact} revealed={revealed} onReveal={reveal} />}
    </PageContent>
  )
}
