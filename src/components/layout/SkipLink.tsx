'use client'

import type { MouseEvent } from 'react'
import { MAIN_ID } from './ids'

/**
 * «Əsas məzmuna keç» (WCAG 2.4.1): the first Tab stop of every page (src/app/layout.tsx). Off screen until it has
 * focus, then pinned to the top left above the sticky header (z-40) and the menu drawer (z-50).
 * Activating it moves focus to <main>: a temporary tabindex lets <main> take focus and is dropped on blur, so clicks
 * inside <main> never focus it (that would close an open popover). Without JavaScript it is a plain "#main" link.
 */
export function SkipLink() {
  const skip = (e: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById(MAIN_ID)
    if (!main) return
    e.preventDefault()
    main.setAttribute('tabindex', '-1')
    main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true })
    main.focus({ preventScroll: true })
    // Scroll only when the top of <main> is out of view or under the sticky header (its scroll-margin-top).
    if (main.getBoundingClientRect().top < parseFloat(getComputedStyle(main).scrollMarginTop || '0')) {
      main.scrollIntoView({ block: 'start' })
    }
  }

  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={skip}
      className="fixed top-3 left-3 z-[60] -translate-y-[200%] rounded-option bg-forest px-4 py-3 text-sm leading-[normal] font-semibold text-white shadow-search focus:translate-y-0"
    >
      Əsas məzmuna keç
    </a>
  )
}
