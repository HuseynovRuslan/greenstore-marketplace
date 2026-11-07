'use client'

import type { ReactNode } from 'react'
import { useBrokenImage } from '@/lib/useBrokenImage'
import { cn } from '@/lib/format'

/**
 * A seller's logo that falls back to the initials tile when the image fails (a deleted or moved file), instead of
 * the browser's broken-image box. The tile is drawn by the caller (SellerAvatar) and passed as `fallback`.
 */
export function SellerLogo({ src, className, fallback }: { src: string; className: string; fallback: ReactNode }) {
  const { failed, imgProps } = useBrokenImage()
  if (failed) return fallback
  return <img src={src} alt="" {...imgProps} className={cn(className, 'object-cover')} />
}
