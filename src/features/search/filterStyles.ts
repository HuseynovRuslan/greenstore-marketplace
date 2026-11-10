import { cn } from '@/lib/format'

/*
 * Class builders of the filter pills (Variant 2), in a module without 'use client' so server components (the seller
 * directory, the services catalogue) can style links and labels like the client filter controls.
 */

/**
 * Filter chip: a chip with a value is forest-filled and shows it ("Qiymət: 50–150 ₼"). `onPhoto` (the home hero's phone
 * row): the forest chip gets a white outline, or it would melt into the forest overlay.
 */
export function chipClass(state: { on: boolean; open?: boolean; touch?: boolean; onPhoto?: boolean }) {
  return cn(
    'flex shrink-0 items-center gap-[7px] rounded-full border px-3.5 text-sm leading-[normal] font-medium whitespace-nowrap',
    state.touch ? 'h-11' : 'h-[38px]',
    // `scale`, not `transform`: Tailwind's scale-* sets the scale property, so the press was not animated before.
    'transition-[background-color,border-color,color,scale] duration-(--dur-fast) ease-out active:scale-[0.97] motion-reduce:active:scale-100',
    state.on
      ? cn('bg-forest text-white hover:bg-forest-hover', state.onPhoto ? 'border-white' : 'border-forest hover:border-forest-hover')
      : state.open
        ? 'border-forest bg-mint text-ink'
        : 'border-line-strong bg-surface text-ink hover:border-forest',
  )
}

/** An option pill inside a popover, the sheet or the sidebar. */
export function optionClass(on: boolean, touch?: boolean) {
  return cn(
    'rounded-full border px-3.5 text-sm leading-[normal] font-medium whitespace-nowrap transition-[color,background-color,border-color,scale] duration-(--dur-fast) ease-out active:scale-[0.97] motion-reduce:active:scale-100',
    touch ? 'h-11' : 'h-[38px]',
    on ? 'border-forest bg-forest text-white' : 'border-line-strong bg-surface text-ink hover:border-forest',
  )
}

