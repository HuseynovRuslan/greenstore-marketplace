'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface RevealState {
  revealed: boolean
  reveal: () => void
}

const RevealContext = createContext<RevealState | null>(null)

/**
 * "Nömrəni göstər" state shared by the contact panel and the mobile contact bar of one page, which sit far apart in
 * a server-rendered tree. Renders no element of its own.
 */
export function RevealProvider({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  const reveal = useCallback(() => setRevealed(true), [])
  const value = useMemo(() => ({ revealed, reveal }), [revealed, reveal])
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>
}

/** The page's shared reveal state; a standalone component without a provider keeps its own. */
export function useReveal(): RevealState {
  const shared = useContext(RevealContext)
  const [revealed, setRevealed] = useState(false)
  const reveal = useCallback(() => setRevealed(true), [])
  return shared ?? { revealed, reveal }
}
