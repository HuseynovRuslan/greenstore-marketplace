'use client'

import { Heart } from 'lucide-react'
import { useAnimationControls } from 'motion/react'
import * as m from 'motion/react-m'
import { heartPop, heartPress } from '@/components/motion/springs'
import { useFavorites, type FavoriteKind } from '@/state/store'
import { cn } from '@/lib/format'

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
  const heart = useAnimationControls()
  return (
    <m.button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${title} — seçilmişlərdən çıxar` : `${title} — seçilmişlərə əlavə et`}
      whileTap="pressed"
      onClick={() => {
        if (!active) heart.start({ scale: 1, transition: heartPop })
        toggleFavorite(kind, id)
      }}
      className={cn('group/fav z-10 flex size-11 items-center justify-center rounded-full', active ? 'text-danger' : 'text-forest', className)}
    >
      <m.span
        variants={{ pressed: { scale: 0.9 } }}
        transition={heartPress}
        className="flex size-[30px] items-center justify-center rounded-full bg-surface/92 transition-[scale] duration-(--dur-fast) group-hover/fav:scale-105 motion-reduce:transition-none motion-reduce:group-hover/fav:scale-100 md:size-8"
      >
        <m.span animate={heart} className="flex">
          <Heart aria-hidden strokeWidth={2} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} className="size-4 md:size-[17px]" />
        </m.span>
      </m.span>
    </m.button>
  )
}
