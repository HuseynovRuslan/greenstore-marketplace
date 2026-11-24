import { describe, expect, it } from 'vitest'
import { businessKindsLabel, orderedKinds, toggleKind } from '@/features/seller/businessKinds'

describe('a business’s kinds', () => {
  it('keeps each known kind once, in the order nursery, garden centre, landscaping', () => {
    expect(orderedKinds(['landscaping', 'nursery', 'landscaping', 'shop'])).toEqual(['nursery', 'landscaping'])
    expect(orderedKinds(undefined)).toEqual([])
  })

  it('names them as one line', () => {
    expect(businessKindsLabel(['garden-centre', 'nursery'])).toBe('Tingçilik təsərrüfatı · Bağ mərkəzi')
    expect(businessKindsLabel([])).toBe('')
  })

  it('ticks and unticks one kind', () => {
    expect(toggleKind(['landscaping'], 'nursery')).toEqual(['nursery', 'landscaping'])
    expect(toggleKind(['nursery', 'landscaping'], 'nursery')).toEqual(['landscaping'])
  })
})
