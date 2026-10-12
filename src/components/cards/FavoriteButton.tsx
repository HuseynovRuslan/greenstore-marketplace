import { Heart } from 'lucide-react'
import { useFavorites, type FavoriteKind } from '@/app/store'
import { cn } from '@/lib/format'

/* Figma "Seçilmişlər düyməsi": 34 px white circle, 18 px heart (1 px stroke).
 * Selected state (components frame "Seçilmiş") switches the heart stroke to #b6443f. */
export function FavoriteButton({ kind, id, title, className }: { kind: FavoriteKind; id: string; title: string; className?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const active = isFavorite(kind, id)
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${title} — seçilmişlərdən çıxar` : `${title} — seçilmişlərə əlavə et`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(kind, id)
      }}
      className={cn(
        'flex size-[34px] items-center justify-center rounded-full bg-surface transition-transform hover:scale-105',
        active ? 'text-danger' : 'text-forest',
        className,
      )}
    >
      <Heart aria-hidden size={18} strokeWidth={1} absoluteStrokeWidth fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
    </button>
  )
}
