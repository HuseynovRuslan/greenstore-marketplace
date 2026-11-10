'use client'

import { useEffect, useReducer, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode, type TransitionEvent } from 'react'
import Image from 'next/image'
import { Pause, Play } from 'lucide-react'
import { heroPhotos } from './heroPhotos'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
/** The CSS animation whose end means "the active photo's time is up" (index.css, .gs-hero-photo). */
const CLOCK = 'gs-hero-clock'

export interface Rotation {
  active: number
  /** The photo the active one is fading in over; idle again once the fade is over. */
  leaving: number | null
  loaded: boolean[]
  /** The active photo's time is up, but no other photo had loaded yet or the rotation was paused. */
  due: boolean
}

export type RotationAction =
  | { type: 'clock'; paused: boolean }
  | { type: 'loaded'; index: number; paused: boolean }
  | { type: 'resume' }
  | { type: 'settled' }
  | { type: 'reset' }

export const initialRotation = (count: number): Rotation => ({
  active: 0,
  leaving: null,
  loaded: Array.from({ length: count }, (_, i) => i === 0),
  due: false,
})

/** Brings in the next photo that has loaded; with none, waits (due) until one has. */
function advance(s: Rotation): Rotation {
  for (let step = 1; step < s.loaded.length; step++) {
    const next = (s.active + step) % s.loaded.length
    if (s.loaded[next]) return { ...s, active: next, leaving: s.active, due: false }
  }
  return { ...s, due: true }
}

/** The rotation as a pure state machine (tested on its own); HeroStage feeds it the CSS clock and image loads. */
export function rotate(s: Rotation, action: RotationAction): Rotation {
  switch (action.type) {
    case 'clock':
      return action.paused ? { ...s, due: true } : advance(s)
    case 'loaded': {
      const next = { ...s, loaded: s.loaded.map((done, i) => done || i === action.index) }
      return next.due && !action.paused ? advance(next) : next
    }
    case 'resume':
      return s.due ? advance(s) : s
    case 'settled':
      return s.leaving === null ? s : { ...s, leaving: null }
    case 'reset':
      return { ...s, active: 0, leaving: null, due: false }
  }
}

/** Runs `run` once the page has loaded and the browser is idle (200 ms later where requestIdleCallback is missing). */
function afterLoadIdle(run: () => void) {
  let idleId: number | undefined
  let timer: number | undefined
  const onLoad = () => {
    if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(run, { timeout: 3000 })
    else timer = window.setTimeout(run, 200)
  }
  if (document.readyState === 'complete') onLoad()
  else window.addEventListener('load', onLoad, { once: true })
  return () => {
    window.removeEventListener('load', onLoad)
    if (idleId !== undefined) window.cancelIdleCallback(idleId)
    window.clearTimeout(timer)
  }
}

/**
 * The home hero's section with its photo background: three nursery photos (heroPhotos.ts) under the forest overlay,
 * each shown for --dur-hero-photo with a slow zoom, then cross-faded into the next (index.css, .gs-hero-photo). The
 * first photo is the LCP image, rendered on the server and preloaded; the other two load only once the page is
 * idle, and the rotation only moves on to a photo that has loaded. The section's forest background stands in while
 * the first photo loads, so the white text is never on white.
 *
 * Moving content needs a way to stop it (WCAG 2.2.2): «Fonu dayandır» / «Fonu davam etdir» at the bottom right,
 * after the hero's content in the tab order. A hidden tab pauses too. With reduced motion only the first photo shows,
 * still, and the button is gone. Content: `children` (server-rendered); the photos are decorative.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const [rotation, dispatch] = useReducer(rotate, heroPhotos.length, initialRotation)
  const [userPaused, setUserPaused] = useState(false)
  const [tabHidden, setTabHidden] = useState(false)
  const [loadRest, setLoadRest] = useState(false)
  const firstLayer = useRef<HTMLDivElement>(null)
  const paused = userPaused || tabHidden

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === 'hidden')
    // A page opened in a background tab starts paused.
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // The other photos: after load + idle, and only while motion is welcome. Turning reduced motion on goes back to the first.
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION)
    let cancel = () => {}
    const update = () => {
      cancel()
      if (query?.matches) {
        dispatch({ type: 'reset' })
        setLoadRest(false)
      } else {
        cancel = afterLoadIdle(() => setLoadRest(true))
      }
    }
    update()
    query?.addEventListener('change', update)
    return () => {
      cancel()
      query?.removeEventListener('change', update)
    }
  }, [])

  // On a slow phone the first photo's time can be up before hydration, when nobody listened for the clock's end.
  useEffect(() => {
    const clock = firstLayer.current?.getAnimations?.().find((a) => 'animationName' in a && a.animationName === CLOCK)
    if (clock?.playState === 'finished') dispatch({ type: 'clock', paused: document.visibilityState === 'hidden' })
  }, [])

  // A photo whose time came up during the pause comes in on resume.
  useEffect(() => {
    if (!paused) dispatch({ type: 'resume' })
  }, [paused])

  const onClock = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.animationName === CLOCK && e.currentTarget.dataset.state === 'active') dispatch({ type: 'clock', paused })
  }
  const onFaded = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === 'opacity') dispatch({ type: 'settled' })
  }

  return (
    // Stacking: the photos are a z-0 layer of their own and the content a positioned layer after them; the section
    // itself is no stacking context, so the search card (z-10) and its popovers still paint over the sections below.
    <section aria-labelledby="hero-title" data-paused={paused || undefined} className="relative w-full bg-forest">
      {/* Clipped here, not on the section: the search card's popovers reach below the hero. */}
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
        {heroPhotos.map((photo, i) => (
          // 8 px past the edges: the zoom and the blur never show an edge.
          <div
            key={photo.src}
            ref={i === 0 ? firstLayer : undefined}
            data-state={i === rotation.active ? 'active' : i === rotation.leaving ? 'leaving' : 'idle'}
            onAnimationEnd={onClock}
            onTransitionEnd={onFaded}
            style={{ '--photo-pos': photo.position, '--photo-pos-phone': photo.phonePosition } as CSSProperties}
            className="gs-hero-photo absolute -inset-2"
          >
            {i === 0 ? (
              <Image src={photo.src} alt="" fill sizes="100vw" preload fetchPriority="high" className="object-cover object-(--photo-pos-phone) md:object-(--photo-pos)" />
            ) : (
              loadRest && (
                <Image
                  src={photo.src}
                  alt=""
                  fill
                  sizes="100vw"
                  loading="eager"
                  fetchPriority="low"
                  onLoad={() => dispatch({ type: 'loaded', index: i, paused })}
                  className="object-cover object-(--photo-pos-phone) md:object-(--photo-pos)"
                />
              )
            )}
          </div>
        ))}
        <div className="absolute inset-0 z-10 bg-linear-to-b from-hero-overlay-top to-hero-overlay-bottom" />
      </div>

      <div className="relative">{children}</div>

      {/* Centred on the categories row: the hero's bottom padding (16 / 24 px) + (48 − 44) / 2. On phones and tablets
          the row's scroller stops short of it (HeroCategories). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[18px] motion-reduce:hidden md:bottom-[26px]">
        <div className="page-x mx-auto flex w-full max-w-[1440px] justify-end">
          <button
            type="button"
            aria-label={userPaused ? 'Fonu davam etdir' : 'Fonu dayandır'}
            onClick={() => setUserPaused((on) => !on)}
            // 44 px target around a 32 px circle; −6 px so the circle lines up with the content's right edge.
            className="group pointer-events-auto -mr-1.5 flex size-11 items-center justify-center rounded-full focus-visible:outline-white"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-forest/70 text-white ring-1 ring-white/45 transition-[background-color,scale] duration-(--dur-fast) ease-out group-hover:bg-forest group-active:scale-[0.94] motion-reduce:group-active:scale-100">
              {userPaused ? (
                <Play aria-hidden size={14} strokeWidth={0} fill="currentColor" className="translate-x-px" />
              ) : (
                <Pause aria-hidden size={14} strokeWidth={0} fill="currentColor" />
              )}
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
