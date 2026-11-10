import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import nextConfig from '../../next.config'
import { heroPhotos } from '@/features/home/heroPhotos'
import { HeroStage, initialRotation, rotate, type Rotation } from '@/features/home/HeroStage'

const allLoaded: Rotation = { ...initialRotation(3), loaded: [true, true, true] }

describe('hero photo rotation (state machine)', () => {
  it('starts on the first photo, the only one loaded', () => {
    expect(initialRotation(3)).toEqual({ active: 0, leaving: null, loaded: [true, false, false], due: false })
  })

  it('fades the next photo in over the current one when the clock runs out, then lets the old one go', () => {
    const next = rotate(allLoaded, { type: 'clock', paused: false })
    expect(next).toMatchObject({ active: 1, leaving: 0, due: false })
    expect(rotate(next, { type: 'settled' })).toMatchObject({ active: 1, leaving: null })
    const last = rotate(rotate(next, { type: 'settled' }), { type: 'clock', paused: false })
    expect(rotate(last, { type: 'clock', paused: false })).toMatchObject({ active: 0, leaving: 2 })
  })

  it('skips photos that have not loaded, and waits for one when none has', () => {
    expect(rotate({ ...allLoaded, loaded: [true, false, true] }, { type: 'clock', paused: false })).toMatchObject({ active: 2, leaving: 0 })
    const waiting = rotate(initialRotation(3), { type: 'clock', paused: false })
    expect(waiting).toMatchObject({ active: 0, leaving: null, due: true })
    // The photo that arrives first comes in at once.
    expect(rotate(waiting, { type: 'loaded', index: 2, paused: false })).toMatchObject({ active: 2, leaving: 0, due: false })
  })

  it('never moves on while paused; a photo that came due comes in on resume', () => {
    const due = rotate(allLoaded, { type: 'clock', paused: true })
    expect(due).toMatchObject({ active: 0, due: true })
    const loadedWhilePaused = rotate({ ...due, loaded: [true, false, false] }, { type: 'loaded', index: 1, paused: true })
    expect(loadedWhilePaused).toMatchObject({ active: 0, due: true, loaded: [true, true, false] })
    expect(rotate(loadedWhilePaused, { type: 'resume' })).toMatchObject({ active: 1, leaving: 0, due: false })
    expect(rotate(allLoaded, { type: 'resume' })).toBe(allLoaded)
  })

  it('goes back to the first photo when reduced motion is switched on', () => {
    const moved = rotate(allLoaded, { type: 'clock', paused: false })
    expect(rotate(moved, { type: 'reset' })).toMatchObject({ active: 0, leaving: null, due: false })
  })
})

describe('HeroStage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const renderStage = () =>
    render(
      <HeroStage>
        <h1 id="hero-title">Azərbaycanda bitki və bağ elanları</h1>
      </HeroStage>,
    )
  const photoImages = (container: HTMLElement) => [...container.querySelectorAll('.gs-hero-photo img')]

  it('renders the first photo with the page (preloaded, decorative) and the others only once the page is idle', () => {
    vi.useFakeTimers()
    const { container } = renderStage()
    expect(screen.getByRole('region', { name: 'Azərbaycanda bitki və bağ elanları' })).toBeInTheDocument()
    const [first, ...rest] = photoImages(container)
    expect(rest).toHaveLength(0)
    expect(first).toHaveAttribute('alt', '')
    expect(first).toHaveAttribute('fetchpriority', 'high')
    expect(first).toHaveAttribute('sizes', '100vw')
    expect(first.getAttribute('src')).toContain(encodeURIComponent(heroPhotos[0].src))
    expect(container.querySelector('.gs-hero-photo')).toHaveAttribute('data-state', 'active')

    // jsdom has no requestIdleCallback: the 200 ms fallback.
    act(() => vi.advanceTimersByTime(250))
    const all = photoImages(container)
    expect(all).toHaveLength(3)
    expect(all[1]).toHaveAttribute('fetchpriority', 'low')
    expect(all[1]).not.toHaveAttribute('loading', 'lazy')
  })

  it('pauses and resumes the background from its button (WCAG 2.2.2), and while the tab is hidden', async () => {
    const user = userEvent.setup()
    const { container } = renderStage()
    const section = container.querySelector('section')!
    expect(section).not.toHaveAttribute('data-paused')

    await user.click(screen.getByRole('button', { name: 'Fonu dayandır' }))
    expect(section).toHaveAttribute('data-paused')
    await user.click(screen.getByRole('button', { name: 'Fonu davam etdir' }))
    expect(section).not.toHaveAttribute('data-paused')

    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(section).toHaveAttribute('data-paused')
    visibility.mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(section).not.toHaveAttribute('data-paused')
    visibility.mockRestore()
  })

  it('cross-fades to the next loaded photo when the active one’s clock animation ends', async () => {
    // jsdom has neither event class, so their names would be lost.
    class AnimationEventStub extends Event {
      animationName: string
      constructor(type: string, init: EventInit & { animationName?: string } = {}) {
        super(type, init)
        this.animationName = init.animationName ?? ''
      }
    }
    class TransitionEventStub extends Event {
      propertyName: string
      constructor(type: string, init: EventInit & { propertyName?: string } = {}) {
        super(type, init)
        this.propertyName = init.propertyName ?? ''
      }
    }
    vi.stubGlobal('AnimationEvent', AnimationEventStub)
    vi.stubGlobal('TransitionEvent', TransitionEventStub)
    vi.useFakeTimers()
    const { container } = renderStage()
    act(() => vi.advanceTimersByTime(250))
    const layers = [...container.querySelectorAll<HTMLElement>('.gs-hero-photo')]
    // next/image reports a load once the photo is decoded (a promise): let it settle.
    await act(async () => {
      fireEvent.load(layers[1].querySelector('img')!)
      await vi.runAllTimersAsync()
    })
    // Another animation ending (the zoom) changes nothing.
    fireEvent.animationEnd(layers[0], { animationName: 'gs-ken-burns' })
    expect(layers[0]).toHaveAttribute('data-state', 'active')

    fireEvent.animationEnd(layers[0], { animationName: 'gs-hero-clock' })
    expect(layers[1]).toHaveAttribute('data-state', 'active')
    expect(layers[0]).toHaveAttribute('data-state', 'leaving')
    fireEvent.transitionEnd(layers[1], { propertyName: 'opacity' })
    expect(layers[0]).toHaveAttribute('data-state', 'idle')
  })

  it('shows only the first photo, still, with reduced motion', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    const { container } = renderStage()
    act(() => vi.advanceTimersByTime(2000))
    expect(photoImages(container)).toHaveLength(1)
    // CSS hides the button (motion-reduce:hidden): nothing moves, so there is nothing to pause.
    expect(screen.getByRole('button', { name: 'Fonu dayandır' }).parentElement?.parentElement).toHaveClass('motion-reduce:hidden')
  })
})

describe('next.config images', () => {
  it('serves AVIF first, WebP as the fallback', () => {
    expect(nextConfig.images?.formats).toEqual(['image/avif', 'image/webp'])
  })
})
