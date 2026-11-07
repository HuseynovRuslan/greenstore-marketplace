'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Index of the slide shown in a horizontal scroll-snap track (one slide per track width), and `goTo` to scroll to
 * one. The scroll follows the page's scroll-behavior, so it jumps under reduced motion. `start` is applied before
 * the first paint.
 */
export function useSnapIndex(count: number, start = 0) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(start)

  useIsoLayoutEffect(() => {
    const track = trackRef.current
    if (track && start > 0) track.scrollLeft = start * track.clientWidth
  }, [start])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1
        setIndex(Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / width))))
      })
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', onScroll)
    }
  }, [count])

  const goTo = useCallback((i: number) => {
    const track = trackRef.current
    if (!track) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (typeof track.scrollTo === 'function') track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
    else track.scrollLeft = i * track.clientWidth
    setIndex(i)
  }, [])

  return { trackRef, index, goTo }
}
