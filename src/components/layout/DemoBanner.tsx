import { useState } from 'react'
import { X } from 'lucide-react'
import { DEMO_MODE } from '@/config/demo'

const DISMISS_KEY = 'greenstore:demo-banner-dismissed'

function readDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Staging notice: the site runs on sample data and a simulated login (see src/config/demo.ts).
 * Not part of the Figma design — it sits above the header and can be dismissed for the browser session.
 */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(readDismissed)
  if (!DEMO_MODE || dismissed) return null

  return (
    <div role="note" aria-label="Demo versiya" className="w-full border-b border-line bg-vip text-ink">
      <div className="page-x mx-auto flex w-full max-w-[1440px] items-start gap-3 py-2 text-xs leading-[1.5]">
        <p className="min-w-0 flex-1">
          <span className="font-semibold text-olive">Demo versiya.</span>{' '}
          <span className="md:hidden">Məlumatlar nümunədir, giriş sınaq üçündür.</span>
          <span className="hidden md:inline">
            Elanlar, satıcılar və hesablar nümunə məlumatlardır. Giriş və qeydiyyat sınaq üçündür, real hesab yaradılmır;
            etdiyiniz dəyişikliklər yalnız bu brauzerdə saxlanılır.
          </span>
        </p>
        <button
          type="button"
          aria-label="Demo bildirişini bağla"
          onClick={() => {
            setDismissed(true)
            try {
              window.sessionStorage.setItem(DISMISS_KEY, '1')
            } catch {
              /* storage unavailable — hide for this page view only */
            }
          }}
          className="-m-1 shrink-0 rounded p-1 text-muted hover:bg-mint hover:text-forest"
        >
          <X aria-hidden size={16} strokeWidth={1.8} absoluteStrokeWidth />
        </button>
      </div>
    </div>
  )
}
