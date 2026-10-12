import { useId, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Panel } from '@/components/ui/Panel'
import { POST_AD_STEPS, STEP_COUNT, type PostAdDraft, type StepNumber } from '@/data/postAd'
import { cn } from '@/lib/format'
import { priceLabel, summaryMeta } from './draft'

/*
 * Wizard-only building blocks (Figma "Elan yerləşdir · 1–6").
 * The neutral "Məlumat bildirişi" here is #eaf0e9 (mint) — the shared Notice only has success/warning/danger tones.
 */

/** Figma "Məlumat bildirişi" (mint): p 18, radius 8, 14 px semibold title + 13 px body, leading 1.6. */
export function InfoNotice({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('w-full rounded-lg bg-mint p-[18px] text-ink', className)}>
      <p className="text-sm leading-[1.6] font-semibold">{title}</p>
      {children && <p className="text-[13px] leading-[1.6]">{children}</p>}
    </div>
  )
}

/** Figma "☐ / ☑ …" option line: 14 px (or 13 px) text, leading 1.5, native checkbox in brand colour. */
export function CheckboxField({
  checked,
  onChange,
  children,
  small,
  error,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  small?: boolean
  error?: string
}) {
  const id = useId()
  return (
    <div className="flex w-full flex-col items-start gap-[7px]">
      <label
        htmlFor={id}
        className={cn('inline-flex cursor-pointer items-start gap-[5px] leading-[1.5] text-ink', small ? 'text-[13px]' : 'text-sm')}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn('size-[13px] shrink-0 cursor-pointer accent-forest', small ? 'mt-[3px]' : 'mt-1')}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] leading-[1.5] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** Figma "Elan növü" radio card: min-h 190, p 24, radius 12; selected = mint + 2 px forest stroke. */
export function KindCard({
  name,
  value,
  selected,
  icon: Icon,
  label,
  description,
  invalid,
  onSelect,
}: {
  name: string
  value: string
  selected: boolean
  icon: LucideIcon
  label: string
  description: string
  invalid?: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={cn(
        'flex min-h-[190px] min-w-0 cursor-pointer flex-col items-start gap-4 rounded-xl text-ink transition-colors focus-within:ring-[3px] focus-within:ring-olive',
        selected ? 'border-2 border-forest bg-mint p-[22px]' : 'border bg-surface p-[23px] hover:border-olive',
        !selected && (invalid ? 'border-danger' : 'border-line'),
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        aria-invalid={invalid ? true : undefined}
        className="sr-only"
      />
      <Icon aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth className="shrink-0 text-forest" />
      <span className="text-[22px] leading-[1.5] font-semibold whitespace-nowrap">
        <span aria-hidden>{selected ? '◉' : '○'} </span>
        {label}
      </span>
      <span className="w-full text-sm leading-[1.5] text-muted">{description}</span>
    </label>
  )
}

type StepState = 'done' | 'current' | 'todo'
const stepState = (n: number, current: number): StepState => (n < current ? 'done' : n === current ? 'current' : 'todo')

/**
 * Figma "Addım göstəricisi" (≥ 768 px): six "İrəliləyiş addımı" columns, 38 px circles, 12 px labels.
 * On phones it collapses to a compact "N/6 · title" header with a 6-segment progress bar.
 */
export function WizardStepper({ current, onSelect }: { current: StepNumber; onSelect: (step: StepNumber) => void }) {
  const currentTitle = POST_AD_STEPS[current - 1].title
  return (
    <nav aria-label="Elan yerləşdirmə addımları" className="w-full">
      <ol className="hidden w-full items-start gap-4 md:flex">
        {POST_AD_STEPS.map((s) => {
          const state = stepState(s.number, current)
          return (
            <li key={s.number} className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelect(s.number)}
                aria-current={state === 'current' ? 'step' : undefined}
                aria-label={`${s.number}. ${s.title}${state === 'done' ? ' (tamamlanıb)' : ''}`}
                className="group flex w-full flex-col items-start gap-2 rounded-lg text-left focus-visible:outline-offset-4"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-[38px] shrink-0 items-center justify-center rounded-full text-sm leading-[1.5] font-semibold transition-shadow group-hover:ring-2 group-hover:ring-olive/40',
                    state === 'todo' ? 'bg-disabled text-muted' : 'bg-forest text-white',
                  )}
                >
                  {state === 'done' ? '✓' : s.number}
                </span>
                <span aria-hidden className={cn('w-full text-[12px] leading-[1.5] text-ink', state === 'current' && 'font-semibold')}>
                  {s.title}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="flex w-full flex-col gap-3 md:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-full bg-forest px-2 text-[13px] leading-[1.5] font-semibold text-white">
            {current}/{STEP_COUNT}
          </span>
          <p aria-current="step" className="min-w-0 text-sm leading-[1.5] font-semibold text-ink">
            {currentTitle}
          </p>
        </div>
        <div className="grid grid-cols-6 gap-1" aria-hidden>
          {POST_AD_STEPS.map((s) => (
            <span key={s.number} className={cn('h-1 rounded-full', s.number <= current ? 'bg-forest' : 'bg-disabled')} />
          ))}
        </div>
      </div>
    </nav>
  )
}

/** Figma "Elanınızın xülasəsi" panel — updates live from the draft. */
export function DraftSummary({ draft }: { draft: PostAdDraft }) {
  const price = priceLabel(draft)
  const meta = summaryMeta(draft)
  return (
    <Panel className="w-full text-ink">
      <h2 className="text-[15px] leading-[1.5] font-semibold">Elanınızın xülasəsi</h2>
      <p className="w-full text-sm leading-[1.5] break-words">{draft.title.trim() || 'Yeni elan'}</p>
      {price && <p className="text-[22px] leading-[1.5] font-semibold">{price}</p>}
      {meta && <p className="w-full text-[13px] leading-[1.5] text-muted">{meta}</p>}
      <Badge tone="neutral">Qaralama</Badge>
    </Panel>
  )
}

/** <img> that falls back to a neutral block when the source is gone (e.g. a `blob:` URL from an earlier session). */
export function SafeImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string>()
  if (!src || failed === src) return <div role="img" aria-label={alt} className={cn('bg-disabled', className)} />
  return <img src={src} alt={alt} onError={() => setFailed(src)} className={cn('object-cover', className)} />
}
