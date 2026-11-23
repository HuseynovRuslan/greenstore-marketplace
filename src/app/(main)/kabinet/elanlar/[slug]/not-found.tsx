import { privateMetadata } from '@/seo/metadata'
import { ListingNotFound } from '@/views/ListingDetailPage'

export const metadata = privateMetadata('Elan tapılmadı')

/**
 * HTTP 404 for an owner preview address that names none of the session's own listings (DATA_SOURCE=api): unknown, or
 * another account's. The mock checks ownership in the browser and shows the same «Elan tapılmadı».
 */
export default function OwnListingNotFound() {
  return <ListingNotFound />
}
