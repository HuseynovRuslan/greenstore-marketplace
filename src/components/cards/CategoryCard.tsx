import { Link } from 'react-router'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Category } from '@/types'

/* Figma "Kateqoriya kartı": p 16, gap 10, radius 12, min-h 112 (132 on 390), 25 px icon, "N elan" 11 px muted, name 13 px semibold */
export function CategoryCard({ category }: { category: Category }) {
  const to = category.kind === 'service' ? `/xidmetler?kateqoriya=${category.id}` : `/elanlar?kateqoriya=${category.id}`
  return (
    <Link
      to={to}
      className="flex min-h-[132px] flex-col items-start gap-2.5 self-start rounded-xl border border-line bg-surface p-[15px] transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover md:min-h-[112px]"
    >
      <span className="flex w-full items-start justify-between">
        <CategoryIcon name={category.icon} />
        <span className="text-[11px] leading-[1.5] whitespace-nowrap text-muted">{category.listingCount} elan</span>
      </span>
      <span className="w-full text-[13px] leading-[1.5] font-semibold text-ink">{category.name}</span>
    </Link>
  )
}
