import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ServiceMatches } from './serviceMatches'

/**
 * «"qazon" xidmətlərdə də var: 2 xidmət ›» above the product results: the catalogue is products only, so a word
 * that services also have points there (one quiet row, not a second result list).
 */
export function ServiceMatchesLink({ matches }: { matches: ServiceMatches }) {
  return (
    <Link
      href={matches.href}
      className="group flex min-h-11 items-center gap-3 rounded-option border border-line bg-surface px-4 py-2.5 text-[15px] leading-[1.4] text-ink transition-colors duration-(--dur-fast) hover:border-forest"
    >
      <span className="min-w-0 flex-1 break-words">
        «{matches.q}» xidmətlərdə də var: <span className="font-semibold whitespace-nowrap text-forest tabular-nums">{formatNumber(matches.total)} xidmət</span>
      </span>
      <ChevronRight
        aria-hidden
        size={18}
        strokeWidth={2}
        className="shrink-0 text-forest transition-transform duration-(--dur-fast) group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  )
}
