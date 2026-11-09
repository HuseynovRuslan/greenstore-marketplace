/*
 * Motion values for the `motion` package: the JavaScript side of the motion tokens in src/styles/index.css (@theme).
 * Springs use Apple-style parameters: `visualDuration` (seconds until it looks settled) and `bounce` (0 = critically
 * damped, no overshoot). Tweens mirror the CSS tokens; keep both sides in step.
 */

/** --ease-out */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const
/** --dur-fast (120 ms), --dur-base (180 ms) and --dur-slow (280 ms), in seconds. */
export const DUR_FAST = 0.12
export const DUR_BASE = 0.18
export const DUR_SLOW = 0.28

/** An opacity change (the reduced-motion stand-in for movement). */
export const fade = { duration: DUR_BASE, ease: EASE_OUT }

/* ---------- Bottom sheet and dialog ---------- */

/** The sheet arriving after a tap: nothing threw it, so no overshoot. */
export const sheetEnter = { type: 'spring', visualDuration: 0.32, bounce: 0 } as const

/** The sheet leaving (×, backdrop, Esc, a flick): faster than it came; a flick's velocity carries into it. */
export const sheetExit = { type: 'spring', visualDuration: 0.25, bounce: 0 } as const

/**
 * Released short of dismissing: back up on Apple's sheet spring (damping ratio .8, response .3 s), starting at the
 * finger's velocity. Motion's drag takes stiffness / damping here: visualDuration .3 + bounce .2 = 305 / 28.
 */
export const sheetSnapBack = { bounceStiffness: 305, bounceDamping: 28 } as const

/** Upward drag past the resting position follows at 5 % (rubber band), downward 1:1. */
export const sheetElastic = { top: 0.05, bottom: 1 } as const

/**
 * Apple's momentum projection (deceleration rate .998): a release at v px/s would travel v × 0.499 px further. The
 * sheet closes when its offset plus that projection passes half its height — a flick closes it from anywhere.
 */
export const PROJECTION_SECONDS = (0.998 / (1 - 0.998)) / 1000

/** Centred dialog (640 px and wider): settles from .97 without overshoot; leaves quicker. */
export const dialogEnter = { type: 'spring', visualDuration: 0.2, bounce: 0 } as const
export const dialogExit = { duration: DUR_FAST, ease: EASE_OUT }

/* ---------- Footer accordions (phones) ---------- */

/*
 * The one place height animates (an explicit request for the footer; elsewhere only transform and opacity move).
 * Opening: the panel grows over --dur-slow, its links fade in a beat later so they never show squashed. Closing is
 * quicker (--dur-base) and the links fade out first. The chevron turns with the height.
 */
export const accordionOpen = {
  height: { duration: DUR_SLOW, ease: EASE_OUT },
  opacity: { duration: DUR_BASE, ease: EASE_OUT, delay: 0.06 },
  rotate: { duration: DUR_SLOW, ease: EASE_OUT },
}
export const accordionClose = {
  height: { duration: DUR_BASE, ease: EASE_OUT },
  opacity: { duration: DUR_FAST, ease: EASE_OUT },
  rotate: { duration: DUR_BASE, ease: EASE_OUT },
}

/* ---------- Favourite heart ---------- */

/** Press: the circle dips quickly, no overshoot. */
export const heartPress = { type: 'spring', visualDuration: 0.12, bounce: 0 } as const

/**
 * Switching on: a velocity kick from rest at scale 1 (stiffness 520, damping 18 → damping ratio ≈ .39). It peaks at
 * ≈ 1.24 after ≈ 56 ms, dips to ≈ 0.94 and settles by ≈ 0.5 s; a quick on/off retargets from wherever it is.
 */
export const heartPop = { type: 'spring', stiffness: 520, damping: 18, velocity: 9 } as const

/* ---------- Active filter chips ---------- */

/** A chip leaving (opacity + scale .95). */
export const chipExit = { type: 'spring', visualDuration: 0.15, bounce: 0 } as const
/** A chip arriving, and its neighbours sliding into the gap a removed chip leaves. */
export const chipEnter = { type: 'spring', visualDuration: 0.2, bounce: 0 } as const
export const chipLayout = { type: 'spring', visualDuration: 0.25, bounce: 0 } as const
