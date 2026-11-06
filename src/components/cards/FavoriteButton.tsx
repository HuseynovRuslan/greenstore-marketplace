'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useFavorites, type FavoriteKind } from '@/state/store'
import { cn } from '@/lib/format'

/*
 * Variant 2 card favourite: a 44 px touch target (transparent) around a 32 px circle (30 px on phones) of white at
 * 92 %, with a 17 / 16 px heart. It sits on the photo, outside the card link. Selected: the heart turns danger red
 * and fills lightly. Switching it on makes the heart pop (scale 1 → 1.25 → 1, 240 ms); hearts that are already on
 * when the page loads stay still, and so does everything under reduced motion.
 */
export function FavoriteButton({ kind, id, title, className }: { kind: FavoriteKind; id: string; title: string; className?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const active = isFavorite(kind, id)
  const [popped, setPopped] = useState(false)
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${title} — seçilmişlərdən çıxar` : `${title} — seçilmişlərə əlavə et`}
      onClick={() => {
        if (!active) setPopped(true)
        toggleFavorite(kind, id)
      }}
      className={cn('group/fav z-10 flex size-11 items-center justify-center rounded-full', active ? 'text-danger' : 'text-forest', className)}
    >
      <span className="flex size-[30px] items-center justify-center rounded-full bg-surface/92 transition-transform duration-(--dur-fast) group-hover/fav:scale-105 motion-reduce:transition-none motion-reduce:group-hover/fav:scale-100 md:size-8">
        <Heart
          aria-hidden
          strokeWidth={2}
          fill={active ? 'currentColor' : 'none'}
          fillOpacity={active ? 0.12 : 0}
          className={cn('size-4 md:size-[17px]', active && popped && 'animate-heart-pop motion-reduce:animate-none')}
        />
      </span>
    </button>
  )
}
