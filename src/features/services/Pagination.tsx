import { ChevronRight } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { pageWindow } from './query'

/* Figma "Səhifələmə": centred row, gap 8; 46 px buttons — current page primary, others secondary; "› Növbəti". */
export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const pages = pageWindow(page, pageCount)
  return (
    <nav aria-label="Səhifələmə" className="flex w-full flex-wrap items-start justify-center gap-2">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Səhifə ${p}`}
          onClick={() => p !== page && onChange(p)}
          className={buttonClass(p === page ? 'primary' : 'secondary', 'min-w-[39px]')}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className={buttonClass('secondary')}
      >
        <ChevronRight aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />
        Növbəti
      </button>
    </nav>
  )
}
