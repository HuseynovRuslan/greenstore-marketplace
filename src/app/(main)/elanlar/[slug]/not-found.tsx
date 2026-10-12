import type { Metadata } from 'next'
import { OwnListingFallback } from '@/features/listing/OwnListingFallback'

export const metadata: Metadata = { title: 'Elan tapılmadı', robots: { index: false, follow: false } }

/** HTTP 404 "Elan tapılmadı"; the demo seller still sees their own unpublished listings here (client-side). */
export default function ListingNotFoundBoundary() {
  return <OwnListingFallback />
}
