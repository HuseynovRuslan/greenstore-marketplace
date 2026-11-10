'use client'

import { useEffect, useState, type RefObject } from 'react'

/** Past this scroll offset the solid header gets its shadow. */
const SCROLLED_AT = 8

/** True once the page is scrolled past 8 px (passive, requestAnimationFrame-throttled scroll listener). */
export function usePageScrolled() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
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
  }, [])
  return scrolled
}

/**
 * True while the header is over the element with `id` (the home hero): some of it is still below the header's bottom
 * edge (IntersectionObserver, root shrunk by the header's height; rebuilt when the header changes height, 58 → 76 px
 * at 768 px). Starts true, as the server renders it, so the home page paints with the transparent header; always
 * false without `enabled`, and from the first frame on without the element or IntersectionObserver.
 */
export function useOverHero(id: string, header: RefObject<HTMLElement | null>, enabled: boolean) {
  const [over, setOver] = useState(enabled)
  useEffect(() => {
    const el = document.getElementById(id)
    const head = header.current
    if (!enabled) return
    if (!el || !head || typeof IntersectionObserver === 'undefined') {
      // Nothing to watch: solid from the next frame on.
      const frame = requestAnimationFrame(() => setOver(false))
      return () => cancelAnimationFrame(frame)
    }
    let observer: IntersectionObserver | undefined
    let height = -1
    const watch = () => {
      if (head.offsetHeight === height) return
      height = head.offsetHeight
      observer?.disconnect()
      observer = new IntersectionObserver((entries) => setOver(entries[entries.length - 1].isIntersecting), {
        rootMargin: `-${height}px 0px 0px 0px`,
      })
      observer.observe(el)
    }
    watch()
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(watch)
    resize?.observe(head)
    return () => {
      observer?.disconnect()
      resize?.disconnect()
    }
  }, [id, header, enabled])
  return over
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
