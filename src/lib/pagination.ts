/** Page numbers shown in "Səhifələmə": a window of up to 3 pages around the current one (Figma: "1 2 3 Növbəti"). */
export function pageWindow(page: number, pageCount: number, size = 3): number[] {
  const count = Math.min(size, pageCount)
  const start = Math.min(Math.max(1, page - 1), pageCount - count + 1)
  return Array.from({ length: count }, (_, i) => start + i)
}

/** `basePath` + `query` with the page parameter set (page 1 drops it, so it has a single URL). */
export function pageHref(basePath: string, query: string, page: number, param = 'sehife'): string {
  const params = new URLSearchParams(query)
  if (page > 1) params.set(param, String(page))
  else params.delete(param)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
