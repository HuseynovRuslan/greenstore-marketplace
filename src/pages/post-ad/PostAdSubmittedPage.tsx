import { useLocation, useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import { useMyListings, useSession } from '@/app/store'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { cityName } from '@/data/cities'
import { listingById } from '@/data/listings'
import { FIGMA_SUBMITTED_LISTING_ID, createEmptyDraft } from '@/data/postAd'
import { sellerById } from '@/data/sellers'
import { SafeImage } from '@/features/post-ad/components'
import { contactFromUser, listingPriceLabel, submittedCardImage } from '@/features/post-ad/draft'
import { LAST_SUBMITTED_KEY, writeDraft } from '@/features/post-ad/useDraft'
import { formatFullDate } from '@/lib/format'

function lastSubmittedId(): string | undefined {
  try {
    return window.localStorage.getItem(LAST_SUBMITTED_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/*
 * Figma "Elan yoxlamaya göndərildi · 1440": 800 px column — success mark, heading, submitted listing card
 * ("Yoxlamada"), "Növbəti mərhələ" notice, status note and two actions.
 */
export default function PostAdSubmittedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSession()
  const { submitted } = useMyListings()

  const id = (location.state as { listingId?: string } | null)?.listingId ?? lastSubmittedId()
  // Without a submission in this browser the page shows the example listing from the Figma frame.
  const listing = submitted.find((l) => l.id === id) ?? listingById(FIGMA_SUBMITTED_LISTING_ID)

  const startNew = () => {
    writeDraft(createEmptyDraft(contactFromUser(user)))
    navigate('/elan-yerlesdir/1')
  }

  return (
    <div className="page-x mx-auto w-full max-w-[1440px] pt-8 pb-10 text-ink md:pt-9 md:pb-12 xl:pt-[51px] xl:pb-[51px]">
      <div className="flex w-full max-w-[800px] flex-col items-start gap-7">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-soft">
          <Check aria-hidden size={32} strokeWidth={1.8} absoluteStrokeWidth className="text-success" />
        </span>

        <div className="w-full">
          <h1 className="text-[23px] leading-[1.35] font-normal md:text-[30px]">Elanınız yoxlamaya göndərildi</h1>
          <p className="text-[15px] leading-[1.43] text-muted">Təşəkkür edirik! Elan təsdiqləndikdən sonra platformada görünəcək.</p>
        </div>

        {listing && (
          <Panel className="w-full">
            <article className="flex w-full flex-col gap-6 md:flex-row">
              <SafeImage
                src={submittedCardImage(listing)}
                alt={listing.title}
                className="h-[200px] w-full shrink-0 rounded-lg md:w-[220px]"
              />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                <Badge tone="warning">Yoxlamada</Badge>
                <h2 className="w-full text-[23px] leading-[1.35] font-normal break-words">{listing.title}</h2>
                <p className="text-[28px] leading-[1.5] font-semibold">{listingPriceLabel(listing)}</p>
                <p className="w-full text-[13px] leading-[1.5] text-muted">
                  {[listing.number && `Elan № ${listing.number}`, cityName(listing.cityId), formatFullDate(listing.publishedAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {sellerById(listing.sellerId) && <p className="w-full text-[13px] leading-[1.5]">{sellerById(listing.sellerId)?.name}</p>}
              </div>
            </article>
          </Panel>
        )}

        <Notice tone="warning" title="Növbəti mərhələ">
          Moderasiya adətən 24 saat ərzində tamamlanır. Nəticə haqqında hesabınızda və SMS vasitəsilə məlumat alacaqsınız. Düzəliş tələb
          olunarsa, səbəb göstəriləcək.
        </Notice>

        <p className="w-full text-sm leading-[1.5] text-muted">
          Elan hazırda axtarışda və ictimai satıcı profilində görünmür. Vəziyyətini “Elanlarım → Yoxlamada olanlar” bölməsində izləyə
          bilərsiniz.
        </p>

        <div className="flex w-full flex-col gap-3 xs:flex-row">
          <ButtonLink to="/kabinet" className="xs:flex-1">
            Elanlarıma keç
          </ButtonLink>
          <Button variant="secondary" onClick={startNew} className="xs:flex-1">
            Yeni elan yerləşdir
          </Button>
        </div>
      </div>
    </div>
  )
}
