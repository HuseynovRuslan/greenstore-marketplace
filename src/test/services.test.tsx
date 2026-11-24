import { describe, expect, it } from 'vitest'
import { serviceHref } from '@/features/services/query'

describe('services catalogue links', () => {
  it('changes one filter and resets the page', () => {
    expect(serviceHref('kateqoriya=cim-salinmasi&sehife=2', { nov: 'sirketler' })).toBe('/xidmetler?kateqoriya=cim-salinmasi&nov=sirketler')
    expect(serviceHref('kateqoriya=cim-salinmasi', { kateqoriya: undefined })).toBe('/xidmetler')
    expect(serviceHref('seher=baki&q=cim', { sehife: '2' })).toBe('/xidmetler?q=cim&sehife=2')
  })
})
