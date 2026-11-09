'use client'

import { useId, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useReducedMotion, type Variants } from 'motion/react'
// `m` from motion/react-m, as everywhere: taken from the motion/react barrel it drags domAnimation into the first load.
import * as m from 'motion/react-m'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { loadDomAnimation, MotionFeatures, useFeaturesReady } from '@/components/motion/MotionFeatures'
import { accordionClose, accordionOpen } from '@/components/motion/springs'
import { cn } from '@/lib/format'
import type { FooterGroup } from './footerLinks'

/** Focus on forest: the site's olive outline is 2.8:1 there; mint is 10.1:1. Inset inside the clipped phone panels. */
const focusOnForest = 'rounded-sm focus-visible:outline-mint max-md:focus-visible:-outline-offset-2'

const linkBase = cn(
  'flex min-h-11 w-full items-center py-2 text-[15px] leading-5 transition-colors duration-(--dur-fast)',
  'hover:text-white hover:underline hover:underline-offset-4 md:inline-flex md:min-h-6 md:w-auto md:py-0.5 md:text-sm',
  focusOnForest,
)
const linkClass = cn(linkBase, 'text-footer-text')

/*
 * Phones: each panel opens and closes in height + opacity (Motion), `visibility: hidden` once closed so its links
 * leave the Tab order and the accessibility tree. From 768 px every panel is open and still: the !important
 * utilities outrank the inline styles Motion leaves behind.
 */
const panel: Variants = {
  open: { height: 'auto', opacity: 1, visibility: 'visible' },
  closed: { height: 0, opacity: 0, transitionEnd: { visibility: 'hidden' } },
}

function Group({ group, defaultOpen }: { group: FooterGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  // Until the Motion bundle is here the `m` elements cannot move: classes show and hide the panel instead.
  const ready = useFeaturesReady()
  const reduce = useReducedMotion() ?? false
  const panelId = `${useId()}-panel`
  const transition = reduce ? { duration: 0 } : open ? accordionOpen : accordionClose
  const rows = Math.ceil(group.links.length / 2)

  return (
    <div className={cn('max-md:border-t max-md:border-mint/20', group.twoColumns && 'md:col-span-2 xl:col-span-1')}>
      {/* Phones: the heading is the disclosure button (APG accordion). From 768 px: a plain heading. */}
      <h2 className="md:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left text-[15px] leading-6 font-semibold text-white',
            focusOnForest,
          )}
        >
          {group.title}
          {ready ? (
            <m.span aria-hidden initial={false} animate={{ rotate: open ? 180 : 0 }} transition={transition} className="flex shrink-0">
              <ChevronDown size={20} strokeWidth={1.8} />
            </m.span>
          ) : (
            <span aria-hidden className={cn('flex shrink-0', open && 'rotate-180')}>
              <ChevronDown size={20} strokeWidth={1.8} />
            </span>
          )}
        </button>
      </h2>
      <h2 className="mb-3.5 text-[15px] leading-6 font-semibold text-white max-md:hidden">{group.title}</h2>

      <m.div
        id={panelId}
        initial={false}
        animate={open ? 'open' : 'closed'}
        variants={panel}
        transition={transition}
        className={cn(
          'max-md:overflow-hidden md:visible! md:h-auto! md:opacity-100!',
          !ready && (open ? 'max-md:visible! max-md:h-auto! max-md:opacity-100!' : 'max-md:hidden'),
        )}
      >
        {/* Kateqoriyalar: two sub-columns, row by row on phones (the 390 mockup), column by column from 768 px. */}
        <ul
          style={{ '--rows': rows } as CSSProperties}
          className={cn(
            'pb-4 md:pb-0',
            // md:gap-x-8 = the grid's gap: from 768 to 1279 px the second sub-column lines up with the column below it.
            group.twoColumns
              ? 'grid grid-cols-2 gap-x-4 md:grid-flow-col md:grid-rows-[repeat(var(--rows),auto)] md:gap-x-8 md:gap-y-1.5 xl:gap-x-6'
              : 'flex flex-col md:gap-1.5',
          )}
        >
          {group.links.map((link) => (
            <li key={link.href + link.label} className="min-w-0">
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {group.more && (
          <Link href={group.more.href} className={cn(linkBase, 'mb-4 gap-1.5 font-semibold text-white md:mt-3 md:mb-0')}>
            {group.more.label}
            <ArrowRight aria-hidden size={16} strokeWidth={2} className="shrink-0" />
          </Link>
        )}
      </m.div>
    </div>
  )
}

/**
 * The footer's link groups, one <nav>. Phones (< 768 px): accordions, «Kateqoriyalar» open. 768–1279 px: three
 * columns (Kateqoriyalar over two of them). From 1280 px: one row of five, beside the brand block (SiteFooter).
 */
export function FooterNav({ groups }: { groups: FooterGroup[] }) {
  return (
    <MotionFeatures load={loadDomAnimation}>
      <nav
        aria-label="Sayt bölmələri"
        className="grid grid-cols-1 max-md:border-b max-md:border-mint/20 md:grid-cols-3 md:gap-x-8 md:gap-y-10 xl:grid-cols-[1.6fr_0.72fr_0.95fr_1fr_0.95fr] xl:gap-x-7"
      >
        {groups.map((group) => (
          <Group key={group.id} group={group} defaultOpen={group.id === 'kateqoriyalar'} />
        ))}
      </nav>
    </MotionFeatures>
  )
}
