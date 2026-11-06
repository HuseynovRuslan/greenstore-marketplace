'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { isPanelOpen } from '@/components/ui/Popover'

/** Past this scroll offset the header gets its "scrolled" look (translucent surface, blur, shadow). */
const SCROLLED_AT = 8
/** The header never hides above this offset. */
const HIDE_AFTER = 320
/** Downward travel (px) that hides the header; any upward scroll shows it again. */
const HIDE_DISTANCE = 6

interface Options {
  enabled?: boolean
  /** Keep the header in place (e.g. while its menu is open). */
  paused?: boolean
}

/**
 * Header state from a passive, requestAnimationFrame-throttled scroll listener.
 * `hidden` never turns on near the top, while a Listbox / popover is open, while focus is inside the header or
 * while `paused`; focus entering the header shows it at once. The header's height never changes (no layout shift):
 * the caller only translates or fades it.
 */
export function useScrollHeader(header: RefObject<HTMLElement | null>, { enabled = true, paused = false }: Options = {}) {
  const [state, setState] = useState({ scrolled: false, hidden: false })
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  })

  useEffect(() => {
    if (!enabled) return
    let lastY = window.scrollY
    let travelled = 0
    let hidden = false
    let frame = 0

    const publish = (scrolled: boolean) =>
      setState((s) => (s.scrolled === scrolled && s.hidden === hidden ? s : { scrolled, hidden }))

    const update = () => {
      frame = 0
      const y = Math.max(0, window.scrollY)
      const delta = y - lastY
      lastY = y
      const el = header.current
      const keep = pausedRef.current || isPanelOpen() || Boolean(el?.contains(document.activeElement))
      if (y <= HIDE_AFTER || delta < 0) {
        travelled = 0
        hidden = false
      } else if (keep) {
        travelled = 0
      } else if (delta > 0) {
        travelled += delta
        if (travelled > HIDE_DISTANCE) hidden = true
      }
      publish(y > SCROLLED_AT)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onFocusIn = () => {
      travelled = 0
      hidden = false
      publish(window.scrollY > SCROLLED_AT)
    }

    frame = requestAnimationFrame(update)
    window.addEventListener('scroll', onScroll, { passive: true })
    const el = header.current
    el?.addEventListener('focusin', onFocusIn)
    return () => {
      window.removeEventListener('scroll', onScroll)
      el?.removeEventListener('focusin', onFocusIn)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, header])

  return state
}

/**
 * True once the element with `id` has scrolled up past the bottom of `header` (IntersectionObserver), e.g. to show
 * the header's compact search pill when the hero search is gone. A new `watchKey` (e.g. the pathname) looks the
 * element up again, for pages that render their own copy of it.
 */
export function useScrolledPast(id: string, header: RefObject<HTMLElement | null>, enabled = true, watchKey?: string) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = document.getElementById(id)
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return
    const top = header.current?.offsetHeight ?? 0
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.top < top), {
      rootMargin: `-${top}px 0px 0px 0px`,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [id, header, enabled, watchKey])
  return past
}
