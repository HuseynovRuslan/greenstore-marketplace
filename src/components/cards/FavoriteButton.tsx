'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import * as m from 'motion/react-m'
import { heartPop, heartPress } from '@/components/motion/springs'
import { useFavorites, type FavoriteKind } from '@/state/store'
import { cn } from '@/lib/format'

/*
 * Two resting targets a hair apart: switching on flips between them, so Motion always has a new target to spring
 * to and the velocity kick makes the pop. (Declarative, so the animation engine stays in the lazily loaded
 * domAnimation bundle instead of the first load, as animation controls would put it.)
 */
const heartKick = { a: { scale: 1, transition: heartPop }, b: { scale: 1.0001, transition: heartPop } }

/*
 * Variant 2 card favourite: a 44 px touch target (transparent) around a 32 px circle (30 px on phones) of white at
 * 92 %, with a 17 / 16 px heart. It sits on the photo, outside the card link. Selected: the heart turns danger red
 * and fills lightly. Motion springs (components/motion/springs.ts): the circle dips to .9 while pressed, and
 * switching on kicks the heart (peak ≈ 1.24, settles in ≈ 0.5 s); a quick on/off carries on from where the spring
 * is instead of jumping. Switching off only changes colour; hearts already on at page load stay still, and so does
 * everything under reduced motion (MotionConfig reducedMotion="user").
 */
export function FavoriteButton({ kind, id, title, className }: { kind: FavoriteKind; id: string; title: string; className?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const active = isFavorite(kind, id)
  const [pops, setPops] = useState(0)
  return (
    <m.button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${title} — seçilmişlərdən çıxar` : `${title} — seçilmişlərə əlavə et`}
      whileTap="pressed"
      onClick={() => {
        if (!active) setPops((n) => n + 1)
        toggleFavorite(kind, id)
      }}
      className={cn('group/fav z-10 flex size-11 items-center justify-center rounded-full', active ? 'text-danger' : 'text-forest', className)}
    >
      <m.span
        variants={{ pressed: { scale: 0.9 } }}
        transition={heartPress}
        className="flex size-[30px] items-center justify-center rounded-full bg-surface/92 transition-[scale] duration-(--dur-fast) group-hover/fav:scale-105 motion-reduce:transition-none motion-reduce:group-hover/fav:scale-100 md:size-8"
      >
        <m.span data-pops={pops || undefined} variants={heartKick} animate={pops % 2 ? 'b' : 'a'} className="flex">
          <Heart aria-hidden strokeWidth={2} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} className="size-4 md:size-[17px]" />
        </m.span>
      </m.span>
    </m.button>
  )
}
