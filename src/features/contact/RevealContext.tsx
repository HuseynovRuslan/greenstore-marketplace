'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToast } from '@/components/ui/Toast'
import type { ContactReveal } from '@/types'
import { revealListingContact, revealSellerContact, type RevealResult } from './actions'

/** Whose number «Nömrəni göstər» asks for: a listing (or a service, also a listing) or a seller page's business. */
export interface RevealTarget {
  kind: 'listing' | 'seller'
  id: string
}

interface RevealState {
  /** The number (or the WhatsApp link) has arrived. */
  revealed: boolean
  /** A request is on its way. */
  pending: boolean
  /** What arrived; empty until then. */
  contact: ContactReveal
  /** Asks once (later calls get the same answer); undefined when it failed, after a toast says so. */
  reveal: () => Promise<ContactReveal | undefined>
}

const RevealContext = createContext<RevealState | null>(null)

const FAILED = 'Nömrəni göstərmək alınmadı. Bir az sonra yenidən cəhd edin.'

const load = (target: RevealTarget): Promise<RevealResult> =>
  target.kind === 'seller' ? revealSellerContact(target.id) : revealListingContact(target.id)

/**
 * "Nömrəni göstər" state shared by the contact panel and the mobile contact bar of one page, which sit far apart in
 * a server-rendered tree. The number is not in the page (backend-contract.md 3.1): the first «Nömrəni göstər» or
 * «WhatsApp-a yaz» asks the server for it, and every button of the page then shows it. `known` is the owner's own
 * contact (their listing's preview), shown without asking. Renders no element of its own.
 */
export function RevealProvider({ target, known, children }: { target?: RevealTarget; known?: ContactReveal; children: ReactNode }) {
  const value = useRevealState(target, known)
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>
}

function useRevealState(target: RevealTarget | undefined, known: ContactReveal | undefined): RevealState {
  const { toast } = useToast()
  const [contact, setContact] = useState<ContactReveal | undefined>()
  const [pending, setPending] = useState(false)
  const inFlight = useRef<Promise<ContactReveal | undefined> | null>(null)
  const kind = target?.kind
  const id = target?.id

  const reveal = useCallback(async () => {
    if (known) {
      setContact(known)
      return known
    }
    if (contact) return contact
    if (!kind || !id) return undefined
    inFlight.current ??= (async () => {
      setPending(true)
      try {
        const result = await load({ kind, id }).catch((): RevealResult => ({ ok: false }))
        if (!result.ok) {
          toast(FAILED, 'error')
          return undefined
        }
        setContact(result.contact)
        return result.contact
      } finally {
        setPending(false)
        inFlight.current = null
      }
    })()
    return inFlight.current
  }, [contact, known, kind, id, toast])

  return useMemo(() => ({ revealed: Boolean(contact), pending, contact: contact ?? {}, reveal }), [contact, pending, reveal])
}

/** The page's shared reveal state; a standalone component (no provider) asks for `target` itself. */
export function useReveal(target?: RevealTarget): RevealState {
  const shared = useContext(RevealContext)
  const own = useRevealState(target, undefined)
  return shared ?? own
}
