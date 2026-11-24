'use client'

import { useId } from 'react'
import { Circle, CircleCheck } from 'lucide-react'
import { Card, PanelTitle } from '@/features/account/ui'

export type CompletenessKey = 'logo' | 'cover' | 'about' | 'address' | 'email'

export interface CompletenessItem {
  key: CompletenessKey
  label: string
  done: boolean
}

const LABELS: Record<CompletenessKey, string> = {
  logo: 'Loqo',
  cover: 'Üz şəkli',
  about: 'Şirkət haqqında',
  address: 'Ünvan',
  email: 'E-poçt',
}

const ORDER: CompletenessKey[] = ['logo', 'cover', 'about', 'address', 'email']

/** What a business profile has of the five things buyers look for, and how much of it, in whole percent. */
export function profileCompleteness(profile: Partial<Record<CompletenessKey, string | undefined>>): { percent: number; items: CompletenessItem[] } {
  const items = ORDER.map((key) => ({ key, label: LABELS[key], done: Boolean(profile[key]?.trim()) }))
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100)
  return { percent, items }
}

/**
 * «Profilin tamlığı»: a bar with the percentage and the checklist; each missing item has «Əlavə et», which opens the
 * photo's file picker or takes the seller to the field (`onAdd`).
 */
export function ProfileCompleteness({ percent, items, onAdd }: { percent: number; items: CompletenessItem[]; onAdd: (key: CompletenessKey) => void }) {
  const titleId = useId()
  return (
    <Card className="w-full gap-4">
      <div className="flex w-full items-baseline justify-between gap-3">
        <PanelTitle id={titleId}>Profilin tamlığı</PanelTitle>
        <span className="text-[26px] leading-none font-semibold text-forest tabular-nums">{percent}%</span>
      </div>
      <div role="progressbar" aria-labelledby={titleId} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-mint">
        <div className="h-full rounded-full bg-forest transition-[width] duration-(--dur-slow) ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-[13px] leading-[1.5] text-muted">
        {percent === 100 ? 'Profiliniz tamdır: alıcılar tam profilə daha çox güvənir.' : 'Tam profil alıcıların etibarını artırır və səhifənizi daha cəlbedici edir.'}
      </p>
      <ul className="flex w-full flex-col">
        {items.map((item) => (
          <li key={item.key} className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-line first:border-t-0">
            <span className={item.done ? 'inline-flex items-center gap-2.5 text-sm text-muted' : 'inline-flex items-center gap-2.5 text-sm font-medium text-ink'}>
              {item.done ? (
                <CircleCheck aria-hidden size={18} strokeWidth={2} className="shrink-0 text-success" />
              ) : (
                <Circle aria-hidden size={18} strokeWidth={2} className="shrink-0 text-line-strong" />
              )}
              {item.label}
              <span className="sr-only">{item.done ? ': var' : ': yoxdur'}</span>
            </span>
            {!item.done && (
              <button
                type="button"
                onClick={() => onAdd(item.key)}
                aria-label={`${item.label}: əlavə et`}
                className="-mr-2 min-h-11 rounded-option px-2 text-sm font-semibold text-forest transition-colors duration-(--dur-fast) hover:bg-mint"
              >
                Əlavə et
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
