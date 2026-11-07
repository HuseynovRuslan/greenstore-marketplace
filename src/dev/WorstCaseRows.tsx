'use client'

import { ListingRowCard, DraftRowCard, type RowHandlers } from '@/features/cabinet/ListingRows'
import { DraftCard } from '@/features/posting/ui'
import type { PostingDraft } from '@/features/posting/draft'
import type { Listing, ListingStats } from '@/types'

const noop: RowHandlers = { renew: () => {}, deactivate: () => {}, activate: () => {}, remove: () => {}, startEdit: async () => {} }

/** The cabinet rows of /dev/worst-case/sehifeler with fixture data; the actions do nothing. */
export function WorstCaseRows({ rows, draft, now }: { rows: Array<{ listing: Listing; stats?: ListingStats }>; draft?: PostingDraft; now: number }) {
  if (!rows.length && !draft) return <p className="text-sm text-muted">Elan yoxdur.</p>
  return (
    <ul className="flex w-full max-w-[1040px] flex-col gap-3">
      {rows.map((r) => (
        <ListingRowCard key={r.listing.id} listing={r.listing} stats={r.stats} now={now} handlers={noop} />
      ))}
      {draft && <DraftRowCard draft={draft} onDiscard={() => {}} />}
    </ul>
  )
}

/** The posting aside's live card with fixture data, at its real width (300 px). */
export function WorstCaseDraftCard({ draft }: { draft: PostingDraft }) {
  return (
    <div className="w-[300px] max-w-full">
      <DraftCard draft={draft} />
    </div>
  )
}
