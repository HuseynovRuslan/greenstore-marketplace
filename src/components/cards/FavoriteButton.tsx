'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useFavorites, type FavoriteKind } from '@/state/store'
import { cn } from '@/lib/format'

/* Figma "Seçilmişlər düyməsi": 34 px white circle, 18 px heart (1 px stroke).
 * Selected state (components frame "Seçilmiş") switches the heart stroke to #b6443f.
 * Switching it on makes the heart pop (scale 1 → 1.25 → 1, 240 ms); hearts that are already on when the page loads
 * stay still, and so does everything under reduced motion. */
export function FavoriteButton({ kind, id, title, className }: { kind: FavoriteKind; id: string; title: string; className?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const active = isFavorite(kind, id)
  const [popped, setPopped] = useState(false)
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${title} — seçilmişlərdən çıxar` : `${title} — seçilmişlərə əlavə et`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!active) setPopped(true)
        toggleFavorite(kind, id)
      }}
      className={cn(
        'flex size-[34px] items-center justify-center rounded-full bg-surface transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100',
        active ? 'text-danger' : 'text-forest',
        className,
      )}
    >
      <Heart
        aria-hidden
        size={18}
        strokeWidth={1}
        absoluteStrokeWidth
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.12 : 0}
        className={cn(active && popped && 'animate-heart-pop motion-reduce:animate-none')}
      />
    </button>
  )
}
