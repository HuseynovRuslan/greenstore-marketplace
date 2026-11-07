'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'

/*
 * Hydration-safe persisted state.
 *
 * The server (and the hydration pass in the browser) always sees the `initial` value — the "server snapshot" — so the
 * server HTML and the first client render match. Right after hydration React re-reads the real stored value and
 * re-renders. Writes notify every hook instance in the tab and other tabs (via the `storage` event).
 * Falls back to an in-memory map when storage is unavailable (private mode, blocked cookies).
 */

type StorageKind = 'local' | 'session'

const memory = new Map<string, string>()
const listeners = new Set<() => void>()

function storage(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function read(kind: StorageKind, key: string): string | null {
  try {
    const s = storage(kind)
    if (s) return s.getItem(key)
  } catch {
    /* fall through to memory */
  }
  return memory.get(`${kind}:${key}`) ?? null
}

function write(kind: StorageKind, key: string, raw: string) {
  try {
    const s = storage(kind)
    if (s) s.setItem(key, raw)
    else memory.set(`${kind}:${key}`, raw)
  } catch {
    memory.set(`${kind}:${key}`, raw)
  }
  listeners.forEach((notify) => notify())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

const serverSnapshot = () => null

function parse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function useStoredState<T>(key: string, initial: T, kind: StorageKind = 'local') {
  // The first `initial` is kept so callers can pass inline literals (`[]`) without changing identity each render.
  const [initialValue] = useState(initial)
  const getSnapshot = useCallback(() => read(kind, key), [kind, key])
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
  const value = useMemo(() => parse(raw, initialValue), [raw, initialValue])

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = parse(read(kind, key), initialValue)
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      write(kind, key, JSON.stringify(resolved))
    },
    [kind, key, initialValue],
  )

  return [value, setValue] as const
}

/** useState persisted to localStorage (hydration-safe, see above). */
export function useLocalStorage<T>(key: string, initial: T) {
  return useStoredState(key, initial, 'local')
}

/** Read a stored value outside React (e.g. inside an event handler). */
export function readStored<T>(key: string, fallback: T, kind: StorageKind = 'local'): T {
  return parse(read(kind, key), fallback)
}

/** Write a stored value outside React and notify subscribed hooks. */
export function writeStored<T>(key: string, value: T, kind: StorageKind = 'local') {
  write(kind, key, JSON.stringify(value))
}
