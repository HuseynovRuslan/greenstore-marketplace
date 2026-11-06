'use client'

import { createContext, useContext, useEffect, useId, type ReactNode } from 'react'
import { Dialog } from '@/components/ui/Dialog'

const SheetBase = createContext('')
const groupId = (base: string, group: string) => `${base}-${group}`

interface FilterSheetShellProps {
  open: boolean
  onClose: () => void
  /** Group to scroll to and focus when the sheet opens from a chip (a `FilterSheetSection` `group`). */
  focus?: string
  /** «Sıfırla»: clears the filters shown in the sheet; disabled when none is set. */
  onReset: () => void
  resetDisabled: boolean
  /** The primary button («Axtar» on home, «N elanı göstər» in the catalogue). The parent closes the sheet. */
  submitLabel: ReactNode
  onSubmit: () => void
  submitDisabled?: boolean
  children: ReactNode
}

/**
 * «Filtrlər» sheet shared by the home search and the catalogue: the site Dialog (a bottom sheet below 640 px),
 * one titled group per filter and a sticky footer with «Sıfırla» and the primary action.
 */
export function FilterSheetShell({ open, onClose, focus, onReset, resetDisabled, submitLabel, onSubmit, submitDisabled, children }: FilterSheetShellProps) {
  const base = useId()

  // The Dialog focuses its panel first (child effects run first); then jump to the chip's group.
  useEffect(() => {
    if (!open || !focus) return
    const group = document.getElementById(groupId(base, focus))
    group?.scrollIntoView?.({ block: 'nearest' })
    group?.querySelector<HTMLElement>('[data-autofocus], button, input')?.focus({ preventScroll: true })
  }, [open, focus, base])

  return (
    <Dialog open={open} title="Filtrlər" onClose={onClose}>
      <SheetBase.Provider value={base}>{children}</SheetBase.Provider>
      <div className="sticky -bottom-6 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t border-line bg-surface px-6 pt-4 pb-6">
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className="h-11 rounded-lg px-2 text-sm leading-[normal] font-semibold text-forest underline underline-offset-[3px] disabled:text-muted disabled:no-underline"
        >
          Sıfırla
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="h-12 rounded-option bg-forest px-8 text-base leading-[normal] font-semibold text-white transition-colors duration-(--dur-fast) hover:bg-forest-hover disabled:bg-line-strong disabled:text-muted"
        >
          {submitLabel}
        </button>
      </div>
    </Dialog>
  )
}

/** One titled group of the sheet; `group` is what `focus` refers to. */
export function FilterSheetSection({ group, title, children }: { group: string; title: string; children: ReactNode }) {
  const id = groupId(useContext(SheetBase), group)
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-2 flex-col gap-3">
      <h3 id={`${id}-title`} className="text-sm leading-[normal] font-semibold text-forest">
        {title}
      </h3>
      {children}
    </section>
  )
}
