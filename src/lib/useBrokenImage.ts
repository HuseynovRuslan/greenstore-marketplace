'use client'

import { useCallback, useState } from 'react'

/**
 * Tells when an <img> failed to load, so the caller can draw its fallback instead of the broken-image box. A
 * server-rendered image can fail before React hydrates and attaches onError, so the ref also checks the image as it
 * mounts (complete, but no pixels).
 */
export function useBrokenImage() {
  const [failed, setFailed] = useState(false)
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [])
  return { failed, imgProps: { ref, onError: () => setFailed(true) } }
}
