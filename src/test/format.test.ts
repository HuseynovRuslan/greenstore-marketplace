import { describe, expect, it } from 'vitest'
import { formatDayMonth, formatFullDate, formatNumber, formatPrice, normalizeSearch } from '@/lib/format'

describe('format helpers', () => {
  it('groups thousands with a space like the Figma copy', () => {
    expect(formatNumber(2480)).toBe('2 480')
    expect(formatNumber(1284)).toBe('1 284')
    expect(formatPrice(145)).toBe('145 ₼')
  })

  it('formats Azerbaijani dates', () => {
    expect(formatDayMonth('2026-10-12T09:00:00')).toBe('12 oktyabr')
    expect(formatFullDate('2026-09-12')).toBe('12 sentyabr 2026')
  })

  it('normalises Azerbaijani letters for search', () => {
    expect(normalizeSearch('Zeytun AĞACI')).toBe(normalizeSearch('zeytun agaci'))
    expect(normalizeSearch('Qaraçöhrə')).toBe('qaracohre')
  })
})
