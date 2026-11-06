import { describe, expect, it } from 'vitest'
import { compareAz, formatDayMonth, formatFullDate, formatNumber, formatPrice, formatRelativeDate, lowerAz, normalizeSearch, upperAz } from '@/lib/format'

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

  it('orders and cases text by Azerbaijani rules, identically on the server and in the browser', () => {
    const names = ['Zeytun ağacı', 'Leyland sərvi', 'Qaraçöhrə', 'İtalyan şamı', 'Çəmən', 'Xurma', 'Ilıq', 'Əncir', 'Dəfnə ağacı']
    expect([...names].sort(compareAz)).toEqual(['Çəmən', 'Dəfnə ağacı', 'Əncir', 'Xurma', 'Ilıq', 'İtalyan şamı', 'Qaraçöhrə', 'Leyland sərvi', 'Zeytun ağacı'])
    expect(lowerAz('İTALYAN IŞIQ')).toBe('italyan ışıq')
    expect(upperAz('dibçəkdə ilıq')).toBe('DİBÇƏKDƏ İLIQ')
  })

  it('formats card dates relative to today in Baku time', () => {
    // 6 November 2026, 10:00 in Baku (06:00 UTC)
    const now = Date.UTC(2026, 10, 6, 6)
    expect(formatRelativeDate('2026-11-06T09:00:00', now)).toBe('bu gün')
    expect(formatRelativeDate('2026-11-05T23:50:00', now)).toBe('dünən')
    expect(formatRelativeDate('2026-11-04T08:00:00', now)).toBe('2 gün əvvəl')
    expect(formatRelativeDate('2026-10-12T09:00:00', now)).toBe('3 həftə əvvəl')
    expect(formatRelativeDate('2026-09-12T10:00:00', now)).toBe('1 ay əvvəl')
    expect(formatRelativeDate('2025-10-01T10:00:00', now)).toBe('1 il əvvəl')
    // 21:30 UTC on 5 November is 01:30 on 6 November in Baku
    expect(formatRelativeDate('2026-11-05T21:30:00Z', now)).toBe('bu gün')
    // A date in the future (clock skew) still reads "bu gün"
    expect(formatRelativeDate('2026-11-07T09:00:00', now)).toBe('bu gün')
  })
})
