'use client'

import { InfoNotice } from '@/components/ui/Notice'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useMyListings, useSession } from '@/state/store'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { listings } from '@/data/listings'
import { POST_AD_STEPS, STEP_COUNT, createEmptyDraft, type StepNumber } from '@/data/postAd'
import { DraftSummary, WizardStepper } from '@/features/post-ad/components'
import { buildListing, contactFromUser, nextListingNumber } from '@/features/post-ad/draft'
import { ContactStep, DetailsStep, KindStep, MediaStep, PreviewStep, PriceStep, type StepProps } from '@/features/post-ad/steps'
import { LAST_SUBMITTED_KEY, usePostAdDraft, writeDraft } from '@/features/post-ad/useDraft'
import { LIVE_FIELDS, firstInvalidStep, isStepValid, validateStep, type FieldKey } from '@/features/post-ad/validation'

const stepPath = (step: StepNumber) => `/elan-yerlesdir/${step}`

const STEP_BODIES: Record<StepNumber, (props: StepProps) => ReactNode> = {
  1: KindStep,
  2: DetailsStep,
  3: MediaStep,
  4: PriceStep,
  5: ContactStep,
  6: PreviewStep,
}

/**
 * Replaces React Router's `location.state`: when the wizard sends the user back to a step that failed validation,
 * that step opens with its errors shown. Kept in memory only, so a reload starts clean (as history state did not
 * survive the Vite build's reloads either).
 */
let pendingErrorStep: StepNumber | null = null

/*
 * Figma "Elan yerləşdir · 1–6" (1440): page header, "Addım göstəricisi", form panel + step navigation,
 * and the "Form köməyi" column (tips, "Elanınızın xülasəsi", help text). Below 1280 px the column moves under the form.
 */
export default function PostAdPage({ step }: { step: StepNumber }) {
  // Keyed by step: each step starts with fresh touched/attempted state and re-reads the saved draft.
  // The route validates the step number (anything outside 1–6 redirects to step 1 on the server).
  return <PostAdWizard key={step} step={step} />
}

function PostAdWizard({ step }: { step: StepNumber }) {
  const router = useRouter()
  const navigate = (href: string) => router.push(href)
  const { user } = useSession()
  const { submitted, addListing } = useMyListings()
  const { draft, update } = usePostAdDraft()
  const formRef = useRef<HTMLFormElement>(null)

  const [redirectedWithErrors] = useState(() => pendingErrorStep === step)
  useEffect(() => {
    if (pendingErrorStep === step) pendingErrorStep = null
  }, [step])
  const [attempted, setAttempted] = useState<Partial<Record<StepNumber, boolean>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [focusTick, setFocusTick] = useState(redirectedWithErrors ? 1 : 0)

  const showAll = Boolean(attempted[step]) || redirectedWithErrors
  const errors = validateStep(step, draft)
  const visibleError = (field: FieldKey) => {
    const message = errors[field]
    if (!message) return undefined
    const liveValue = LIVE_FIELDS.includes(field) && String(draft[field]).trim() !== ''
    return showAll || touched[field] || liveValue ? message : undefined
  }
  const touch = useCallback((field: FieldKey) => setTouched((t) => (t[field] ? t : { ...t, [field]: true })), [])

  // Move focus to the first invalid control after a failed "Davam et" / redirect.
  useEffect(() => {
    if (!focusTick) return
    const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (el) {
      el.focus({ preventScroll: true })
      ;(el.closest('label, div') ?? el).scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [focusTick])

  const revealErrors = (target: StepNumber) => {
    if (target === step) {
      setAttempted((a) => ({ ...a, [step]: true }))
      setFocusTick((t) => t + 1)
    } else {
      pendingErrorStep = target
      navigate(stepPath(target))
    }
  }

  /** Moves forward and remembers the furthest step (written directly: this keyed instance unmounts on navigation). */
  const advanceTo = (target: StepNumber) => {
    if (target > draft.reachedStep) writeDraft({ ...draft, reachedStep: target })
    navigate(stepPath(target))
  }

  /** Stepper: earlier steps open directly; later ones require every step before them to validate. */
  const goToStep = (target: StepNumber) => {
    if (target <= step) return navigate(stepPath(target))
    const invalid = firstInvalidStep(draft, (target - 1) as StepNumber)
    if (invalid) return revealErrors(invalid)
    advanceTo(target)
  }

  const submitAd = () => {
    const invalid = firstInvalidStep(draft, STEP_COUNT as StepNumber)
    if (invalid) return revealErrors(invalid)
    if (!user) {
      // The draft stays in localStorage; the login page brings the user back to the preview.
      navigate('/daxil-ol?next=/elan-yerlesdir/6')
      return
    }
    const number = nextListingNumber([...listings, ...submitted])
    const listing = buildListing(draft, { number, sellerId: user.sellerId ?? 'abseron-tingcilik', now: new Date() })
    addListing(listing)
    try {
      window.localStorage.setItem(LAST_SUBMITTED_KEY, listing.id)
    } catch {
      /* ignore */
    }
    // Start the next ad from a blank draft (written directly so this page does not re-render empty before leaving).
    writeDraft(createEmptyDraft(contactFromUser(user)))
    navigate('/elan-yerlesdir/gonderildi')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (step === STEP_COUNT) return submitAd()
    if (!isStepValid(step, draft)) return revealErrors(step)
    advanceTo((step + 1) as StepNumber)
  }

  const onBack = () => {
    if (step === 1) navigate(user ? '/kabinet' : '/')
    else navigate(stepPath((step - 1) as StepNumber))
  }

  // Deep links past the furthest step reached (e.g. /elan-yerlesdir/6 on a blank draft) go back to that step.
  const beyondReached = step > draft.reachedStep
  useEffect(() => {
    if (beyondReached) router.replace(stepPath(draft.reachedStep))
  }, [beyondReached, draft.reachedStep, router])
  if (beyondReached) return null

  const stepTitle = POST_AD_STEPS[step - 1].title
  const StepBody = STEP_BODIES[step]
  const subtitle = [draft.title.trim() || 'Yeni elan', draft.sellerName.trim()].filter(Boolean).join(' · ')

  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-6 pt-6 pb-10 text-ink md:gap-7 md:pt-9 md:pb-12 xl:pt-[51px] xl:pb-[51px]">
      {/* Figma "Elan yerləşdirmə başlığı" */}
      <header className="flex w-full flex-col gap-2.5">
        <p className="text-[13px] leading-[1.5] text-muted">Yeni elan · Qaralama avtomatik saxlanılıb</p>
        <div className="min-w-0">
          <h1 className="text-[23px] leading-[1.35] font-normal md:text-[30px]">Elan yerləşdir</h1>
          <p className="text-[15px] leading-[1.43] break-words text-muted">{subtitle}</p>
        </div>
      </header>

      <WizardStepper current={step} onSelect={goToStep} />

      {/* Figma "Elan forması və kömək" */}
      <div className="flex w-full flex-col items-start gap-7 xl:flex-row">
        <form ref={formRef} noValidate onSubmit={onSubmit} className="flex w-full min-w-0 flex-col gap-6 xl:flex-1" aria-labelledby="post-ad-step-title">
          <Panel className="w-full">
            <h2 id="post-ad-step-title" className="w-full text-[23px] leading-[1.35] font-normal">
              {step}/{STEP_COUNT} · {stepTitle}
            </h2>
            <StepBody
              draft={draft}
              update={update}
              error={visibleError}
              touch={touch}
              verifiedPhone={user?.phone}
            />
          </Panel>

          {/* Figma "Addım naviqasiyası" */}
          <div className="flex w-full items-start justify-between gap-3">
            <Button variant="secondary" onClick={onBack} icon={<ArrowLeft aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
              {step === 1 ? 'Ləğv et' : 'Geri'}
            </Button>
            {step === STEP_COUNT ? (
              <Button type="submit" icon={<Check aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
                Yoxlamaya göndər
              </Button>
            ) : (
              <Button type="submit" icon={<ArrowRight aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
                Davam et
              </Button>
            )}
          </div>
        </form>

        {/* Figma "Form köməyi" */}
        <aside aria-label="Elan haqqında" className="grid w-full grid-cols-1 items-start gap-5 md:grid-cols-2 xl:w-[358px] xl:shrink-0 xl:grid-cols-1">
          <InfoNotice title="Düzgün məlumat, daha yaxşı elan">
            Başlıq, şəkillər və qiymət məhsulu dəqiq əks etdirməlidir. Telefon nömrəsini yalnız əlaqə sahəsində qeyd edin.
          </InfoNotice>
          <DraftSummary draft={draft} />
          <p className="text-[12px] leading-[1.5] text-muted md:col-span-2 xl:col-span-1">
            Kömək lazımdır? Elan qaydalarına baxın və ya dəstək komandası ilə əlaqə saxlayın.
          </p>
        </aside>
      </div>
    </div>
  )
}
