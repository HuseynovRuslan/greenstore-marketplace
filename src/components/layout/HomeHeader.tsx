'use client'

import { HERO_END_ID } from '@/features/home/ids'
import { usePastHero } from '@/hooks/useHeaderState'
import { SiteHeader } from './SiteHeader'

/**
 * The home page's two headers (HomeFrame), never both in use:
 * - the transparent one, absolutely positioned at the top of the hero (this component sits at the top of the
 *   positioned wrapper that starts with the hero), so it scrolls away with the hero;
 * - the solid one, fixed above the screen while any part of the hero is still in the window, so it never covers the
 *   hero. Once the sentinel at the hero's bottom has scrolled out of the window (usePastHero), it slides in and stays
 *   until the hero comes back.
 * The one not in use is inert and hidden from assistive tech.
 */
export function HomeHeader() {
  const pastHero = usePastHero(HERO_END_ID)
  return (
    <>
      <SiteHeader placement="hero" active={!pastHero} />
      <SiteHeader placement="fixed" active={pastHero} />
    </>
  )
}
