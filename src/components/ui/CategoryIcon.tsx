import { Amphora, Droplets, Fence, Flower, Flower2, Scissors, Shovel, Sprout, Trees, Wheat, type LucideProps } from 'lucide-react'
import type { IconName } from '@/types'

const icons = {
  trees: Trees,
  'flower-2': Flower2,
  flower: Flower,
  sprout: Sprout,
  wheat: Wheat,
  shovel: Shovel,
  amphora: Amphora,
  droplets: Droplets,
  scissors: Scissors,
  fence: Fence,
} satisfies Record<IconName, unknown>

/* Category icons in Figma are Lucide glyphs, 25 px, 1.8 px stroke, #173f32 */
export function CategoryIcon({ name, size = 25, ...rest }: { name: IconName } & LucideProps) {
  const Icon = icons[name]
  return <Icon aria-hidden size={size} strokeWidth={1.8} absoluteStrokeWidth className="shrink-0 text-forest" {...rest} />
}
