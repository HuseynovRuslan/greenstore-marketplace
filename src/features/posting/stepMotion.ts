/*
 * Direction of a step change in «Elan yerləşdir», for the step's entrance (index.css → .gs-step): «Davam et» and a
 * later step link go forward (the new step comes in from the right), «Geri» and an earlier step link go back (from
 * the left). Marked just before the navigation and read by the step that mounts; a first load, a reload or the
 * browser's own back button finds no mark and shows the step at rest.
 */

export type StepDirection = 'forward' | 'back'

let mark: { to: number; dir: StepDirection; at: number } | undefined

/** Call right before navigating from step `from` to step `to`. */
export function markStepChange(from: number, to: number) {
  mark = from === to ? undefined : { to, dir: to > from ? 'forward' : 'back', at: Date.now() }
}

/**
 * The direction the step `step` was reached in, if it was reached from another step a moment ago. Pure, so React may
 * call it twice (Strict Mode); clear the mark with `clearStepChange` once the step has mounted.
 */
export function stepDirection(step: number): StepDirection | undefined {
  return mark && mark.to === step && Date.now() - mark.at < 3000 ? mark.dir : undefined
}

export function clearStepChange() {
  mark = undefined
}
