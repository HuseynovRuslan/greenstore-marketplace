'use client'

import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InfoNotice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { LoadingFrame, SkeletonBlock, SkeletonText } from '@/components/ui/Skeleton'
import { POST_AD_STEPS, STEP_COUNT, type StepNumber } from '@/data/postAd'
import { WizardStepper } from './components'

/**
 * Height of each step's form body with the default draft (measured from the rendered wizard at 390 / 768 / 1440),
 * so the placeholder reserves the space the fields will take.
 */
const STEP_BODY: Record<StepNumber, string> = {
  1: 'h-[591px] md:h-[352px]',
  2: 'h-[990px] md:h-[574px]',
  3: 'h-[1059px] md:h-[819px] xl:h-[798px]',
  4: 'h-[809px] md:h-[662px]',
  5: 'h-[655px] md:h-[614px] xl:h-[594px]',
  6: 'h-[994px] md:h-[976px] xl:h-[955px]',
}

const noop = () => {}

/**
 * "Elan yerləşdir" while the saved draft is read from the browser: the real page header, step indicator, panel
 * title, navigation and help column, with placeholders only where the draft's values go. The buttons look final but
 * do nothing until the wizard has loaded (a moment later).
 */
export function WizardSkeleton({ step }: { step: StepNumber }) {
  return (
    <LoadingFrame>
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-6 pt-6 pb-10 text-ink md:gap-7 md:pt-9 md:pb-12 xl:pt-[51px] xl:pb-[51px]">
        <header className="flex w-full flex-col gap-2.5">
          <p className="text-[13px] leading-[1.5] text-muted">Yeni elan · Qaralama avtomatik saxlanılıb</p>
          <div className="min-w-0">
            <h1 className="text-[23px] leading-[1.35] font-normal md:text-[30px]">Elan yerləşdir</h1>
            <p className="text-[15px] leading-[1.43] text-muted">
              <SkeletonText className="w-[16em]" />
            </p>
          </div>
        </header>

        <WizardStepper current={step} onSelect={noop} />

        <div className="flex w-full flex-col items-start gap-7 xl:flex-row">
          <div className="flex w-full min-w-0 flex-col gap-6 xl:flex-1">
            <Panel className="w-full">
              <h2 className="w-full text-[23px] leading-[1.35] font-normal">
                {step}/{STEP_COUNT} · {POST_AD_STEPS[step - 1].title}
              </h2>
              <SkeletonBlock className={`w-full ${STEP_BODY[step]}`} />
            </Panel>
            <div className="flex w-full items-start justify-between gap-3">
              <Button variant="secondary" icon={<ArrowLeft aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
                {step === 1 ? 'Ləğv et' : 'Geri'}
              </Button>
              {step === STEP_COUNT ? (
                <Button icon={<Check aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
                  Yoxlamaya göndər
                </Button>
              ) : (
                <Button icon={<ArrowRight aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
                  Davam et
                </Button>
              )}
            </div>
          </div>

          <aside aria-label="Elan haqqında" className="grid w-full grid-cols-1 items-start gap-5 md:grid-cols-2 xl:w-[358px] xl:shrink-0 xl:grid-cols-1">
            <InfoNotice title="Düzgün məlumat, daha yaxşı elan">
              Başlıq, şəkillər və qiymət məhsulu dəqiq əks etdirməlidir. Telefon nömrəsini yalnız əlaqə sahəsində qeyd edin.
            </InfoNotice>
            <Panel className="w-full text-ink">
              <h2 className="text-[15px] leading-[1.5] font-semibold">Elanınızın xülasəsi</h2>
              <p className="w-full text-sm leading-[1.5]">
                <SkeletonText className="w-4/5" />
              </p>
              <p className="text-[22px] leading-[1.5] font-semibold">
                <SkeletonText className="w-[3.5em]" />
              </p>
              <p className="w-full text-[13px] leading-[1.5]">
                <SkeletonText className="w-3/5" />
              </p>
              <SkeletonBlock className="h-[25px] w-[76px] rounded-[5px]" />
            </Panel>
            <p className="text-[12px] leading-[1.5] text-muted md:col-span-2 xl:col-span-1">
              Kömək lazımdır? Elan qaydalarına baxın və ya dəstək komandası ilə əlaqə saxlayın.
            </p>
          </aside>
        </div>
      </div>
    </LoadingFrame>
  )
}
