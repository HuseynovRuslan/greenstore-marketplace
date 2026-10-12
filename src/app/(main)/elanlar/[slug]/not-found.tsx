import type { Metadata } from 'next'
import { ListingNotFound } from '@/views/ListingDetailPage'

export const metadata: Metadata = { title: 'Elan tapılmadı', robots: { index: false, follow: false } }

/**
 * HTTP 404 for unknown, pending, expired and rejected listings — for everyone. Sellers open their own unpublished
 * listings in the private owner preview (/kabinet/elanlar/[slug]).
 */
export default function ListingNotFoundBoundary() {
  return <ListingNotFound />
}
