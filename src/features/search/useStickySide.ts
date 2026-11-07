'use client'

import { useEffect, useRef } from 'react'

/**
 * Keeps `--side-h` on the element at its height, for the `sticky-side` utility (styles/index.css): a sidebar that
 * fits the window sticks under the header; a taller one scrolls with the page and then sticks by its bottom edge.
 */
export function useStickySide<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => el.style.setProperty('--side-h', `${el.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return ref
}
