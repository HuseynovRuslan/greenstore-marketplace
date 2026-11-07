import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { sellers } from '@/data/sellers'
import { atTime, bakuClock, groupHours, openStatus } from '@/features/seller/hours'
import SellersDirectoryPage, { parseDirectoryQuery } from '@/views/SellersDirectoryPage'
import type { OpeningHours } from '@/types'

const weekdays: OpeningHours[] = [1, 2, 3, 4, 5].map((day) => ({ day: day as OpeningHours['day'], open: '09:00', close: '17:00' }))
const quba: OpeningHours[] = [...weekdays, { day: 6, open: '09:00', close: '14:00' }, { day: 7, closed: true }]

/** A UTC instant for a Baku wall-clock time (UTC+4). 2026-11-09 is a Monday. */
const baku = (iso: string) => new Date(new Date(`${iso}Z`).getTime() - 4 * 3_600_000)

describe('opening hours', () => {
  it('groups days with the same hours', () => {
    expect(groupHours(quba).map((r) => `${r.days} ${r.time}`)).toEqual(['B.e.–C. 09:00–17:00', 'Ş. 09:00–14:00', 'B. Bağlıdır'])
    const everyDay = [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day: day as OpeningHours['day'], open: '09:00', close: '18:00' }))
    expect(groupHours(everyDay)).toEqual([{ days: 'Hər gün', time: '09:00–18:00', dayNumbers: [1, 2, 3, 4, 5, 6, 7] }])
  })

  it('reads the clock in Baku time', () => {
    expect(bakuClock(baku('2026-11-09T10:30:00'))).toEqual({ day: 1, minute: 630 })
  })

  it('says whether the business is open and when it opens next', () => {
    expect(openStatus(quba, baku('2026-11-09T10:00:00'))).toEqual({ open: true, label: 'İndi açıqdır · 17:00-dək' })
    expect(openStatus(quba, baku('2026-11-09T07:30:00')).label).toBe('Bağlıdır · bu gün 09:00-da açılır')
    expect(openStatus(quba, baku('2026-11-09T18:00:00')).label).toBe('Bağlıdır · sabah 09:00-da açılır')
    // Saturday afternoon → closed Sunday → Monday
    expect(openStatus(quba, baku('2026-11-14T15:00:00')).label).toBe('Bağlıdır · Bazar ertəsi 09:00-da açılır')
  })

  it('reads the time suffix aloud correctly', () => {
    expect(atTime('09:00')).toBe('09:00-da')
    expect(atTime('10:00')).toBe('10:00-da')
    expect(atTime('11:00')).toBe('11:00-də')
    expect(atTime('08:00')).toBe('08:00-də')
    expect(atTime('09:30')).toBe('09:30-da')
    expect(atTime('09:15')).toBe('09:15-də')
  })
})

describe('seller directory', () => {
  const business = sellers.filter((s) => s.type === 'business')

  it('parses the kind and city from the URL and ignores unknown values', () => {
    expect(parseDirectoryQuery(new URLSearchParams('nov=landsaft&seher=baki'))).toEqual({ kind: 'landscaping', city: 'baki' })
    expect(parseDirectoryQuery(new URLSearchParams('nov=x&seher=paris'))).toEqual({ kind: '', city: '' })
  })

  it('counts each kind in the chosen city and lists the matching businesses', () => {
    render(<SellersDirectoryPage sellers={business} kind="nursery" city="" />)
    const tabs = screen.getByRole('navigation', { name: 'Biznesin növü' })
    expect(within(tabs).getByRole('link', { name: /Tingçiliklər 2/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Abşeron Tingçilik' })).toHaveAttribute('href', '/saticilar/abseron-tingcilik')
    expect(screen.queryByRole('link', { name: 'Yaşıl Bağ Mərkəzi' })).not.toBeInTheDocument()
  })

  it('shows the empty state when nothing matches', () => {
    render(<SellersDirectoryPage sellers={business} kind="landscaping" city="quba" />)
    expect(screen.getByText('Bu seçimlə satıcı tapılmadı')).toBeInTheDocument()
  })
})
