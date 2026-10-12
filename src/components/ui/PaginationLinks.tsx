'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { buttonClass } from './Button'
import { pageHref, pageWindow } from '@/lib/pagination'

interface PaginationLinksProps {
  page: number
  pageCount: number
  basePath: string
  /** Current query string (filters, sort) kept on every page link. */
  query: string
  /** Element brought into view after switching pages (the results list). */
  scrollTargetId?: string
}

/**
 * Figma "Səhifələmə": centred row, gap 8; 46 px buttons — current page primary, others secondary; "› Növbəti".
 * Real links (`?sehife=N`), so search engines can crawl every page; the page is rendered on the server.
 */
export function PaginationLinks({ page, pageCount, basePath, query, scrollTargetId }: PaginationLinksProps) {
  const scroll = () => {
    if (scrollTargetId) document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <nav aria-label="Səhifələmə" className="flex w-full flex-wrap items-start justify-center gap-2">
      {pageWindow(page, pageCount).map((p) => (
        <Link
          key={p}
          href={pageHref(basePath, query, p)}
          scroll={false}
          onClick={p === page ? (e) => e.preventDefault() : scroll}
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Səhifə ${p}`}
          className={buttonClass(p === page ? 'primary' : 'secondary', 'min-w-[39px]')}
        >
          {p}
        </Link>
      ))}
      {page >= pageCount ? (
        <button type="button" disabled className={buttonClass('secondary')}>
          <ChevronRight aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />
          Növbəti
        </button>
      ) : (
        <Link href={pageHref(basePath, query, page + 1)} scroll={false} onClick={scroll} rel="next" className={buttonClass('secondary')}>
          <ChevronRight aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />
          Növbəti
        </Link>
      )}
    </nav>
  )
}
