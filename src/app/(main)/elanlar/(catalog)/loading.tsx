import { CatalogSkeleton } from '@/features/search/CatalogSkeleton'

/** Shown while the catalogue opens from another page (filter changes on the page keep the old results). */
export default function Loading() {
  return <CatalogSkeleton />
}
