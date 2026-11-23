'use client'

import { useEffect, useRef } from 'react'
import { recordView } from './actions'

/**
 * Tells the server once per page view that the listing (or service) was seen (backend-contract.md 3.4): the page
 * itself is cached and cannot count. Renders nothing; a page that opens another listing counts that one too.
 */
export function ViewBeacon({ listingId }: { listingId: string }) {
  // StrictMode runs effects twice in development; the ref keeps it to one call per listing.
  const sent = useRef<string | null>(null)
  useEffect(() => {
    if (sent.current === listingId) return
    sent.current = listingId
    void recordView(listingId).catch(() => undefined)
  }, [listingId])
  return null
}
