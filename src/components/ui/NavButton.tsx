'use client'

import { useRouter } from 'next/navigation'
import { Button } from './Button'
import type { ComponentProps } from 'react'

/** A `Button` that navigates (e.g. "Filtrləri təmizlə" → the unfiltered catalogue) without resetting the scroll. */
export function NavButton({ href, ...rest }: Omit<ComponentProps<typeof Button>, 'onClick'> & { href: string }) {
  const router = useRouter()
  return <Button {...rest} onClick={() => router.push(href, { scroll: false })} />
}
