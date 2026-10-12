import { useEffect, useState } from 'react'

/** useState persisted to localStorage (silently falls back to memory when storage is unavailable). */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable (private mode) — keep in memory only */
    }
  }, [key, value])

  return [value, setValue] as const
}
