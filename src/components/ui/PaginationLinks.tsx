'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/format'
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

const pageClass =
  'flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-option border px-3.5 text-[15px] leading-[normal] font-semibold tabular-nums transition-colors duration-(--dur-fast)'
const idle = 'border-line-strong bg-surface text-ink hover:border-forest hover:text-forest'

/**
 * Page links (Variant 2 look: 44 px, the current page forest-filled, «Növbəti ›»). Real links (`?sehife=N`), so
 * search engines can crawl every page; the page is rendered on the server. Switching pages brings the list's top
 * into view (instantly under reduced motion).
 */
export function PaginationLinks({ page, pageCount, basePath, query, scrollTargetId }: PaginationLinksProps) {
  const scroll = () => {
    if (!scrollTargetId) return
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }
  const next = (
    <>
      Növbəti
      <ChevronRight aria-hidden size={18} strokeWidth={2} className="-mr-1" />
    </>
  )
  return (
    <nav aria-label="Səhifələmə" className="flex w-full flex-wrap items-center justify-center gap-2">
      {pageWindow(page, pageCount).map((p) => (
        <Link
          key={p}
          href={pageHref(basePath, query, p)}
          scroll={false}
          onClick={p === page ? (e) => e.preventDefault() : scroll}
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Səhifə ${p}`}
          className={cn(pageClass, p === page ? 'border-forest bg-forest text-white' : idle)}
        >
          {p}
        </Link>
      ))}
      {page >= pageCount ? (
        <button type="button" disabled className={cn(pageClass, 'border-line bg-surface text-muted')}>
          {next}
        </button>
      ) : (
        <Link href={pageHref(basePath, query, page + 1)} scroll={false} onClick={scroll} rel="next" className={cn(pageClass, idle)}>
          {next}
        </Link>
      )}
    </nav>
  )
}
