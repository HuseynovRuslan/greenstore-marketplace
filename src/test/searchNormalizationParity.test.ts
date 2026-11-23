import { describe, expect, it } from 'vitest'
import { normalizeSearch } from '@/lib/format'
import contract from '../../backend/contracts/search-normalization.json'

/**
 * The API normalises search text like the catalogue does (backend/src/GreenStore.Api/Common/Localization/SearchText.cs),
 * so a query finds the same listings with DATA_SOURCE=mock and DATA_SOURCE=api. Both sides run these vectors; the
 * backend test is backend/tests/GreenStore.Api.Tests/Common/SearchTextTests.cs. Vectors marked `backendOnly` describe
 * API behaviour the frontend does not have, and are skipped here.
 */
interface NormalizationVector {
  input: string
  expected: string
  note?: string
  backendOnly?: boolean
}

const vectors = contract.vectors as NormalizationVector[]
const shared = vectors.filter((v) => !v.backendOnly)

describe('search normalisation parity with the API', () => {
  it('shares the vectors for Azerbaijani, Cyrillic, case, spaces and diacritics', () => {
    expect(shared.length).toBeGreaterThanOrEqual(30)
    for (const input of ['İ', 'I', 'ı', 'ЁЛКА', 'ёлка']) expect(shared.map((v) => v.input)).toContain(input)
  })

  it.each(shared.map((v) => [JSON.stringify(v.input), v] as const))('normalizeSearch(%s)', (_, vector) => {
    expect(normalizeSearch(vector.input)).toBe(vector.expected)
  })
})
