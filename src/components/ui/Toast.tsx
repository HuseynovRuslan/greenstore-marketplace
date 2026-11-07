'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleCheck, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/format'

type ToastTone = 'success' | 'error'
interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastValue {
  /** Shows a short confirmation ("Keçid kopyalandı") for 3.5 s. Never steals focus. */
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const VISIBLE_MS = 3500

/**
 * Brief confirmations after an action that has no other visible result (copy a link, save a search, renew a
 * listing). One polite live region announces them; the toast rises 8 px and fades in from @starting-style, and
 * fades out (reduced motion: fade only). Bottom centre, above the phone bottom nav.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++
    setItems((prev) => [...prev.slice(-2), { id, message, tone }])
  }, [])
  // Stable, so a new toast does not restart the timers of the ones already showing.
  const remove = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), [])
  const value = useMemo(() => ({ toast }), [toast])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(100px+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDone={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const hide = window.setTimeout(() => setLeaving(true), VISIBLE_MS)
    const remove = window.setTimeout(() => onDone(item.id), VISIBLE_MS + 200)
    return () => {
      window.clearTimeout(hide)
      window.clearTimeout(remove)
    }
  }, [onDone, item.id])
  const Icon = item.tone === 'error' ? CircleAlert : CircleCheck
  return (
    <div
      className={cn(
        'flex max-w-[min(420px,100%)] items-center gap-2.5 rounded-panel bg-ink px-4 py-3 text-sm leading-[1.4] font-medium text-white shadow-popover',
        'transition-[opacity,translate] duration-(--dur-base) ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-opacity motion-reduce:starting:translate-y-0',
        leaving && 'translate-y-1 opacity-0 duration-(--dur-fast) motion-reduce:translate-y-0',
      )}
    >
      <Icon aria-hidden size={18} strokeWidth={2} className={item.tone === 'error' ? 'shrink-0 text-danger-soft' : 'shrink-0 text-success-soft'} />
      <span>{item.message}</span>
    </div>
  )
}

/** `toast()` from the nearest ToastProvider (a no-op outside one, e.g. in isolated component tests). */
export function useToast(): ToastValue {
  return useContext(ToastContext) ?? { toast: () => {} }
}
