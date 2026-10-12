/** Next.js `searchParams` (a plain object) → URLSearchParams, keeping repeated keys in order. */
export type RawSearchParams = Record<string, string | string[] | undefined>

export function toSearchParams(raw: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
    else if (value != null) params.append(key, value)
  }
  return params
}

/** Copy of `params` with only the given keys (e.g. the presentation parameters of a category page). */
export function pickParams(params: URLSearchParams, keys: string[]): URLSearchParams {
  const picked = new URLSearchParams()
  for (const key of keys) {
    const value = params.get(key)
    if (value != null && value !== '') picked.set(key, value)
  }
  return picked
}
