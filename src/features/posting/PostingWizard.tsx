'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CloudCheck, LogIn, RotateCcw, Send } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Notice } from '@/components/ui/Notice'
import { cn } from '@/lib/format'
import { useMyListings, useSession } from '@/state/store'
import { submitPosting } from './actions'
import { STEPS, hasProgress, toListing, type StepNumber } from './draft'
import { PhotoManager } from './PhotoManager'
import { PostingSkeleton } from './PostingSkeleton'
import { photoStore, thumbnailDataUrl } from './photos'
import { ReviewStep } from './ReviewStep'
import { clearStepChange, markStepChange, stepDirection } from './stepMotion'
import { CategoryStep, ContactStep, DetailsStep, PriceStep, type StepProps } from './steps'
import { DraftCard, ErrorSummary, StepProgress, stepPath } from './ui'
import { LAST_SENT_KEY, usePhotoUrls, usePostingDraft } from './useDraft'
import { firstInvalidStep, validateStep } from './validation'

/** Field names for the error summary («Başlıq: Başlıq yazın…»). */
const LABELS: Record<string, string> = {
  kind: 'Elanın növü',
  categoryId: 'Kateqoriya',
  subcategory: 'Alt kateqoriya',
  title: 'Başlıq',
  description: 'Təsvir',
  photos: 'Şəkillər',
  price: 'Qiymət',
  priceUnit: 'Vahid',
  wholesalePrice: 'Topdan qiymət',
  wholesaleMin: 'Ən az sifariş',
  quantity: 'Stokda neçə var',
  cityId: 'Şəhər və ya rayon',
  area: 'Ərazi',
  deliveryAreas: 'Hara çatdırırsınız',
  contactName: 'Adınız',
  phone: 'Telefon nömrəsi',
  whatsapp: 'WhatsApp',
  rulesAccepted: 'Elan qaydaları',
}

const TIPS: Record<StepNumber, string[]> = {
  1: ['Doğru kateqoriya elanı həmin bitkini axtaran alıcıya çatdırır.', 'Xidmət göstərirsinizsə, «Xidmət göstərirəm» seçin: elan «Xidmətlər» bölməsində görünəcək.'],
  2: ['Başlıqda növü və ölçünü yazın: «Tuya Smaragd — 140 sm».', 'Hündürlük, kök sistemi və qulluq məlumatı alıcının ilk suallarıdır.'],
  3: ['İlk şəkil örtükdür: bitki bütövlükdə, işıqlı yerdə görünsün.', 'Kök sistemini, yarpaqları və dibçəyi yaxından çəkin.'],
  4: ['Topdan qiymət tingçiliklər və bağ şirkətləri üçün cəlbedicidir.', 'Dəqiq ünvanı yazmayın: kənd və ya qəsəbə kifayətdir.'],
  5: ['WhatsApp açıq olsun: alıcıların çoxu əvvəl yazır.', 'Nömrəni gizlətsəniz də, WhatsApp-da yaza biləcəklər.'],
  6: [],
}

const timeOf = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * «Elan yerləşdir» — six steps on their own URLs (/elan-yerlesdir/1…6), one autosaved draft. «Davam et» checks the
 * step: errors appear next to the fields and in a summary that takes focus; Back and the step links keep
 * everything. A deep link past the furthest step reached goes back there. Guests can fill the whole form; sending
 * asks them to sign in and the draft waits. Phones get the buttons in a bar fixed to the bottom.
 */
export function PostingWizard({ step }: { step: StepNumber }) {
  const router = useRouter()
  const { user } = useSession()
  const { addListing } = useMyListings()
  const { draft, update, reset } = usePostingDraft(user)
  const urls = usePhotoUrls(draft.photos)
  const [attempted, setAttempted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string>()
  const [resetOpen, setResetOpen] = useState(false)
  // Sent: the draft is reset on the way to the confirmation, which must not trip the step guard below.
  const [sent, setSent] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Reached from another step: the heading and the form come in from that side (index.css → .gs-step).
  const [dir] = useState(() => stepDirection(step))
  const [navigating, startNavigation] = useTransition()

  // Deep link beyond the furthest reached step → back to it.
  const allowed = step <= draft.reachedStep
  useEffect(() => {
    if (!allowed && !sent) router.replace(stepPath(draft.reachedStep))
  }, [allowed, sent, draft.reachedStep, router])

  // A new step: its heading takes focus, so a screen reader announces where the user is.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    clearStepChange()
  }, [step])

  // The neighbouring steps are fetched ahead, so «Davam et» and «Geri» answer at once.
  useEffect(() => {
    if (step < 6) router.prefetch(stepPath(step + 1))
    if (step > 1) router.prefetch(stepPath(step - 1))
  }, [step, router])

  const go = (to: number) => {
    markStepChange(step, to)
    startNavigation(() => router.push(stepPath(to)))
  }

  const errors = validateStep(step, draft)
  const shown = Object.fromEntries(Object.entries(errors).filter(([k]) => attempted || touched[k]))
  const stepProps: StepProps = {
    draft,
    update,
    user,
    error: (key) => shown[key],
    touch: (key) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })),
  }

  const failed = () => {
    setAttempted(true)
    requestAnimationFrame(() => summaryRef.current?.focus())
  }

  const next = async (e: FormEvent) => {
    e.preventDefault()
    if (Object.keys(errors).length) return failed()
    if (step < 6) {
      const n = (step + 1) as StepNumber
      update((d) => ({ ...d, reachedStep: Math.max(d.reachedStep, n) as StepNumber }))
      go(n)
      return
    }
    // Step 6: send.
    const invalid = firstInvalidStep(draft)
    if (invalid) return go(invalid)
    if (!user) return
    setSending(true)
    setSendError(undefined)
    const result = await submitPosting(draft)
    if (!result.ok) {
      setSending(false)
      setSendError(result.error)
      if (result.step) go(result.step)
      return
    }
    // The demo keeps a copy in «Elanlarım» with small photos (data URLs survive a reload; blob URLs don't).
    const blobs = await Promise.all(draft.photos.map((p) => photoStore.get(p.id)))
    const images = (await Promise.all(blobs.map((b) => (b ? thumbnailDataUrl(b) : undefined)))).filter((u): u is string => Boolean(u))
    const editing = draft.editing
    const number = editing?.number ?? result.result.number
    const built = toListing(draft, { images, now: new Date(), number, sellerId: user.sellerId })
    // An edit keeps the listing's id, number and address; it goes back to review.
    const listing = editing ? { ...built, id: editing.id, slug: editing.slug, updatedAt: new Date().toISOString() } : built
    addListing(listing)
    try {
      window.localStorage.setItem(LAST_SENT_KEY, JSON.stringify({ id: listing.id, promotion: draft.promotion, edited: Boolean(editing) }))
    } catch {
      /* storage full: the confirmation page falls back to «Elanlarım» */
    }
    setSent(true)
    reset()
    router.replace('/elan-yerlesdir/gonderildi')
  }

  if (!allowed || sent) return sent ? <PostingSkeleton /> : null
  const meta = STEPS[step - 1]
  const editing = Boolean(draft.editing)
  const back = step > 1 ? stepPath(step - 1) : undefined

  let body: ReactNode
  switch (step) {
    case 1:
      body = <CategoryStep {...stepProps} />
      break
    case 2:
      body = <DetailsStep {...stepProps} />
      break
    case 3:
      body = <PhotoManager {...stepProps} urls={urls} />
      break
    case 4:
      body = <PriceStep {...stepProps} />
      break
    case 5:
      body = <ContactStep {...stepProps} />
      break
    default:
      body = <ReviewStep {...stepProps} urls={urls} />
  }

  const review = step === 6
  const primaryLabel = review ? (sending ? 'Göndərilir…' : editing ? 'Dəyişiklikləri göndər' : 'Elanı göndər') : 'Davam et'
  const primaryIcon = review ? <Send aria-hidden size={18} strokeWidth={1.8} /> : <ArrowRight aria-hidden size={18} strokeWidth={1.8} />
  const guestAtEnd = review && !user

  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:gap-8 md:pt-8 md:pb-16">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div data-dir={dir} className="gs-step flex flex-col gap-1.5">
            <p className="text-[13px] leading-[normal] font-medium text-muted">
              {editing ? 'Elanı redaktə edirsiniz · ' : ''}Addım {step} / {STEPS.length} · {meta.title}
            </p>
            <h1 ref={headingRef} tabIndex={-1} className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest outline-none md:text-[30px]">
              {meta.heading}
            </h1>
          </div>
          {draft.savedAt && hasProgress(draft) && (
            <div className="flex items-center gap-3 text-[13px] leading-[normal] text-muted">
              <span className="inline-flex items-center gap-1.5" role="status">
                <CloudCheck aria-hidden size={16} strokeWidth={1.8} className="text-success" />
                Qaralama saxlanıldı · {timeOf(draft.savedAt)}
              </span>
              <button type="button" onClick={() => setResetOpen(true)} className="inline-flex min-h-11 items-center gap-1 font-medium text-forest hover:text-olive-text">
                <RotateCcw aria-hidden size={14} strokeWidth={2} />
                Yenidən başla
              </button>
            </div>
          )}
        </div>
        <StepProgress step={step} reached={draft.reachedStep} dir={dir} />
      </header>

      <div className={cn('grid grid-cols-1 gap-8', !review && 'lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]')}>
        <form id="elan-formu" onSubmit={next} noValidate className="flex min-w-0 flex-col gap-6">
          <ErrorSummary ref={summaryRef} errors={attempted ? errors : {}} labels={LABELS} />
          {/* The phone button bar below is position: fixed, so it stays outside the animated box (a transform would hold it). */}
          <div data-dir={dir} className={cn('gs-step', !review && 'rounded-2xl border border-line bg-surface p-5 md:p-7')}>
            {body}
          </div>

          {sendError && (
            <Notice tone="danger" title="Elan göndərilmədi">
              {sendError}
            </Notice>
          )}
          {guestAtEnd && (
            <Notice tone="info" title="Göndərmək üçün hesabınıza daxil olun">
              Qaralama bu brauzerdə saxlanılır: daxil olandan sonra bura qayıdacaqsınız.
              <span className="mt-3 flex flex-wrap gap-2.5">
                <ButtonLink href={`/daxil-ol?next=${encodeURIComponent(stepPath(6))}`} icon={<LogIn aria-hidden size={17} strokeWidth={1.8} />}>
                  Daxil ol
                </ButtonLink>
                <ButtonLink href={`/qeydiyyat?next=${encodeURIComponent(stepPath(6))}`} variant="secondary">
                  Qeydiyyat
                </ButtonLink>
              </span>
            </Notice>
          )}

          {/* ≥ 768 px: the buttons under the form. Phones: the same buttons in a bar fixed to the bottom. */}
          <div className="gs-keyboard-aside fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-line bg-surface/95 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] backdrop-blur-md md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            {back && (
              <ButtonLink
                href={back}
                onClick={() => markStepChange(step, step - 1)}
                variant="secondary"
                icon={<ArrowLeft aria-hidden size={18} strokeWidth={1.8} />}
                className="max-md:px-3.5"
              >
                Geri
              </ButtonLink>
            )}
            <Button type="submit" disabled={sending || navigating || guestAtEnd} aria-busy={sending || navigating} className="flex-1 md:ml-auto md:flex-none md:min-w-[180px]">
              {primaryLabel}
              {primaryIcon}
            </Button>
          </div>
        </form>

        {!review && (
          <aside aria-label="Elanınız" className="flex flex-col gap-4 max-lg:hidden">
            <p className="text-[13px] leading-[normal] font-semibold text-ink-soft">Elan kartda belə görünəcək</p>
            <DraftCard draft={draft} cover={draft.photos[0] ? urls[draft.photos[0].id] : undefined} />
            {TIPS[step].length > 0 && (
              <ul className="flex flex-col gap-2.5 rounded-xl bg-mint p-4 text-[13px] leading-[1.5] text-ink">
                {TIPS[step].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-forest" />
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs leading-[1.5] text-muted">
              Sualınız var? <Link href="/komek" className="font-semibold text-forest hover:underline">Kömək</Link>
            </p>
          </aside>
        )}
      </div>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} title="Yenidən başlayaq?">
        <p className="text-[15px] leading-[1.5] text-ink">Qaralama və əlavə etdiyiniz şəkillər silinəcək. Bunu geri qaytarmaq olmaz.</p>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            Qaralamanı saxla
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              reset()
              setResetOpen(false)
              setAttempted(false)
              setTouched({})
              go(1)
            }}
          >
            Sil və yenidən başla
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
