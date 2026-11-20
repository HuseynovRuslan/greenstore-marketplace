'use client'

import { useEffect, useId, useRef, useState, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { panelAlignClass, useOutsidePress, usePanelAlign, usePresence } from '@/components/ui/Popover'
import { cn, initials } from '@/lib/format'

/*
 * Hover intent, mouse only: a pointer that just passes over the avatar doesn't open the menu, and one crossing the
 * 8 px gap to the panel (or cutting its corner) doesn't close it. Not animation durations: the motion is .gs-panel's.
 */
const HOVER_OPEN_MS = 80
const HOVER_CLOSE_MS = 180

/**
 * Round initials avatar, forest with white letters on every header. `name` is undefined before hydration: the
 * letters then come from CSS (--gs-user-initials, set by the pre-hydration script), so the first paint already shows
 * them. A name without a single letter gets a person icon instead of initials()'s "?".
 *
 * Centring: in a leading-none line box Inter's capitals sit exactly in the middle (baseline at 0.863 em, cap height
 * 0.727 em), so flex centring centres Ə, E and the other capitals themselves; measured in Chromium, the ink is within
 * 0.15 px of the circle's centre. No tracking: letter-spacing would add space after the last letter.
 */
function Avatar({ name, className }: { name: string | undefined; className: string }) {
  const letters = name === undefined ? null : initials(name)
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-forest text-center leading-none font-semibold text-white select-none',
        name === undefined && 'auth-user-initials',
        className,
      )}
    >
      {letters === '?' ? <UserRound size={16} strokeWidth={1.8} absoluteStrokeWidth /> : letters}
    </span>
  )
}

/**
 * The signed-in account in the site header (≥ 768 px; phones reach the cabinet from the bottom bar and the drawer):
 * a capsule with the initials avatar, a link to /kabinet, and a chevron button that opens a small menu (the avatar and
 * full name, also a link to /kabinet; «Çıxış»). Two controls side by side, never one inside the other.
 *
 * The menu is a disclosure, right-aligned under the capsule:
 * - mouse: opens on hover (after HOVER_OPEN_MS) and closes once the pointer has left capsule and panel;
 * - click, tap or keyboard on the chevron: opens it pinned, so it stays until the chevron, Esc, a press outside, Tab
 *   out of it or a navigation closes it. Focus moving into a hover-opened panel pins it too.
 * Esc returns focus to the chevron. Over the home hero (the header's over-hero: variant) the capsule turns glassy and
 * the chevron white; the avatar and the white panel are the same on every header.
 */
export function ProfileMenu({ fullName, onSignOut, className }: { fullName: string | undefined; onSignOut: () => void; className?: string }) {
  const pathname = usePathname()
  const id = useId()
  const panelId = `${id}-panel`
  const nameId = `${id}-name`
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)

  // The page it was opened on (navigating closes it, like the drawer) and whether it is pinned open.
  const [menu, setMenu] = useState<{ path: string; pinned: boolean } | null>(null)
  const open = menu?.path === pathname
  const pinned = open && menu.pinned
  // Opened from the keyboard or closed with Esc: no animation (.gs-panel[data-instant]), as in Popover.
  const [instant, setInstant] = useState(false)
  const { present, state, onTransitionEnd } = usePresence(open)
  usePanelAlign(present, panelRef, 'end')

  const clearTimer = () => window.clearTimeout(timer.current)
  useEffect(() => {
    const pending = timer
    return () => window.clearTimeout(pending.current)
  }, [])

  const close = (how: 'animate' | 'instant' = 'animate') => {
    clearTimer()
    setInstant(how === 'instant')
    setMenu(null)
  }
  useOutsidePress(open, rootRef, close)

  // Esc closes it wherever focus is (a hover-opened menu has none inside); focus inside goes back to the chevron.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const focusInside = rootRef.current?.contains(document.activeElement)
      clearTimer()
      setInstant(true)
      setMenu(null)
      if (focusInside) triggerRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const onPointerEnter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimer()
    if (open) return
    timer.current = window.setTimeout(() => {
      setInstant(false)
      setMenu((m) => (m?.path === pathname ? m : { path: pathname, pinned: false }))
    }, HOVER_OPEN_MS)
  }
  const onPointerLeave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimer()
    if (!open || pinned) return
    timer.current = window.setTimeout(() => {
      setInstant(false)
      setMenu((m) => (m?.pinned ? m : null))
    }, HOVER_CLOSE_MS)
  }
  // A click on the chevron of a hover-opened menu keeps it open (pinned); a second click closes it.
  const onTriggerClick = (e: ReactMouseEvent) => {
    clearTimer()
    setInstant(e.detail === 0)
    setMenu(pinned ? null : { path: pathname, pinned: true })
  }
  const pinOnFocus = () => {
    if (open && !pinned) setMenu({ path: pathname, pinned: true })
  }
  // Tabbing out of capsule and panel closes the menu; a press outside is useOutsidePress's.
  const onBlur = (e: ReactFocusEvent) => {
    const next = e.relatedTarget
    if (open && next instanceof Node && !rootRef.current?.contains(next)) close()
  }

  return (
    <div ref={rootRef} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur} className={cn('relative shrink-0', className)}>
      <div className="flex h-11 items-center gap-px rounded-full border border-transparent bg-mint py-[3px] pr-1 pl-[3px] transition-colors duration-(--dur-base) ease-out hover:bg-line over-hero:border-surface/30 over-hero:bg-surface/10 over-hero:hover:bg-surface/20">
        <Link
          href="/kabinet"
          aria-label="Şəxsi kabinet"
          className="flex rounded-full transition-[scale] duration-(--dur-fast) ease-out active:scale-[0.95] motion-reduce:active:scale-100"
        >
          <Avatar name={fullName} className="size-9 text-[13px]" />
        </Link>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Hesab menyusu"
          aria-expanded={open}
          aria-controls={present ? panelId : undefined}
          onClick={onTriggerClick}
          // The pseudo-element stretches the 28 × 36 button's hit area to the capsule's full height.
          className="relative flex h-9 w-7 items-center justify-center rounded-full text-forest after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] over-hero:text-white"
        >
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={2}
            className={cn('transition-transform duration-(--dur-base) ease-out motion-reduce:transition-none', open && 'rotate-180')}
          />
        </button>
      </div>

      {present && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-labelledby={nameId}
          data-state={state}
          data-instant={instant || undefined}
          inert={!open}
          onTransitionEnd={onTransitionEnd}
          onFocus={pinOnFocus}
          className={cn(
            'gs-panel absolute top-[calc(100%+8px)] z-30 w-60 max-w-[calc(100vw-16px)] rounded-panel border border-line/70 bg-surface p-1.5 shadow-menu',
            panelAlignClass,
            // A bridge over the gap, so the pointer never leaves the menu on its way down.
            "before:absolute before:inset-x-0 before:-top-2.5 before:h-2.5 before:content-['']",
            // White panel: olive focus outlines, also over the hero (whose header makes them white).
            '[&_:focus-visible]:outline-olive',
          )}
        >
          {/* The whole row leads to the cabinet; it closes the menu at once (also when already on /kabinet). */}
          <Link
            href="/kabinet"
            onClick={() => close('instant')}
            className="flex cursor-pointer items-center gap-3 rounded-option p-2 transition-colors duration-(--dur-base) ease-out hover:bg-mint active:bg-line"
          >
            <Avatar name={fullName} className="size-8 text-xs" />
            <span id={nameId} className="line-clamp-2 min-w-0 text-sm leading-[1.35] font-semibold break-words text-ink">
              {fullName}
            </span>
          </Link>
          <div aria-hidden className="mx-1 my-1.5 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              close('instant')
              onSignOut()
            }}
            className="flex h-10 w-full items-center gap-2.5 rounded-option px-2 text-left text-sm font-medium text-ink-soft transition-colors duration-(--dur-base) ease-out hover:bg-danger-soft hover:text-danger"
          >
            <LogOut aria-hidden size={17} strokeWidth={1.8} absoluteStrokeWidth className="shrink-0" />
            Çıxış
          </button>
        </div>
      )}
    </div>
  )
}
