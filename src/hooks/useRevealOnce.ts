'use client'

import { useEffect, useRef } from 'react'

/**
 * Reveals a block once when it scrolls into view (IntersectionObserver, `threshold` of it visible): sets
 * data-reveal="pending" and then "done"; the CSS in index.css does the motion. Blocks already on screen when the
 * page hydrates are left alone (server HTML stays visible, nothing flashes), and so is everything under
 * prefers-reduced-motion.
 */
export function useRevealOnce<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    el.setAttribute('data-reveal', 'pending')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.setAttribute('data-reveal', 'done')
        observer.disconnect()
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return ref
}
