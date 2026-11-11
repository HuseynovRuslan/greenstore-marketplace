'use client'

import { useEffect, useState, type RefObject } from 'react'

/** Past this scroll offset the solid header gets its shadow. */
const SCROLLED_AT = 8

/** True once the page is scrolled past 8 px (passive, requestAnimationFrame-throttled scroll listener). */
export function usePageScrolled(enabled = true) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const update = () => {
      frame = 0
      setScrolled(window.scrollY > SCROLLED_AT)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled])
  return enabled && scrolled
}

/**
 * True once the sentinel with `id` (a 1 px line at the bottom of the home hero) has scrolled up out of the window, i.e.
 * no part of the hero is left under the header's strip at the top. An IntersectionObserver on the window (rootMargin
 * 0: a root shrunk by the header's height let the solid header come in over the last 58 / 76 px of the hero, the
 * categories row); no scroll listener. False on the server and without the sentinel or IntersectionObserver.
 */
export function usePastHero(id: string) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const sentinel = document.getElementById(id)
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      // Out of the window above its top = scrolled past; out of it below the bottom = not reached yet.
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0))
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [id])
  return past
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
