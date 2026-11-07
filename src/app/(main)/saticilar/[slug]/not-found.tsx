import type { Metadata } from 'next'
import { SellerNotFound } from '@/views/SellerPage'

export const metadata: Metadata = { title: 'Satıcı tapılmadı', robots: { index: false, follow: false } }

export default function SellerNotFoundBoundary() {
  return <SellerNotFound />
}
