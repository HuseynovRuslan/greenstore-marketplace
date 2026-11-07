import { describe, expect, it } from 'vitest'
import {
  ageLabel,
  heightLabel,
  heightOptions,
  isRange,
  parseRange,
  priceError,
  priceValueLabel,
  sellerChipLabel,
} from '@/features/search/filterDefs'

describe('shared filter labels (home search and catalogue)', () => {
  it('labels price presets and typed ranges the same way, with the suffix of «manat»', () => {
    expect(priceValueLabel('50', '150')).toBe('50–150 ₼')
    expect(priceValueLabel('', '50')).toBe('50 ₼-a qədər')
    expect(priceValueLabel('300', '')).toBe('300 ₼-dan çox')
    expect(priceValueLabel('80', '1200')).toBe('80–1 200 ₼')
    expect(priceValueLabel('', '100')).toBe('100 ₼-a qədər')
    expect(priceValueLabel(' 30 ', '')).toBe('30 ₼-dan çox')
    expect(priceValueLabel('', '')).toBeUndefined()
  })

  it('rejects a negative price and a minimum above the maximum', () => {
    expect(priceError({ min: '200', max: '100' })).toBe('Minimum qiymət maksimumdan böyük ola bilməz.')
    expect(priceError({ min: '-5', max: '' })).toBe('Qiymət sıfırdan az ola bilməz.')
    expect(priceError({ min: '50', max: '50' })).toBeUndefined()
    expect(priceError({ min: '', max: '' })).toBeUndefined()
  })

  it('labels the home height presets in metres and older cm ranges in cm', () => {
    expect(heightOptions.map((o) => heightLabel(o.value))).toEqual(['1 m-ə qədər', '1–2 m', '2–3 m', '3 m-dən uca'])
    expect(heightLabel('80-200')).toBe('80–200 sm')
    expect(heightLabel('-80')).toBe('80 sm-ə qədər')
    expect(heightLabel('200-')).toBe('200 sm-dən uca')
  })

  it('labels ages', () => {
    expect(ageLabel('2-5')).toBe('2–5 yaş')
    expect(ageLabel('5-')).toBe('5 yaşdan yuxarı')
    expect(ageLabel('3-4')).toBe('3–4 yaş')
    expect(ageLabel('-3')).toBe('3 yaşa qədər')
  })

  it('reads range params', () => {
    expect(parseRange('100-200')).toEqual([100, 200])
    expect(parseRange('300-')).toEqual([300, undefined])
    expect(parseRange('x')).toEqual([undefined, undefined])
    expect(isRange('-100')).toBe(true)
    expect(isRange('-')).toBe(false)
    expect(isRange('1-2-3')).toBe(false)
  })

  it('names the seller chips', () => {
    expect(sellerChipLabel('biznes')).toBe('Biznes satıcılar')
    expect(sellerChipLabel('ferdi')).toBe('Fərdi satıcılar')
    expect(sellerChipLabel('')).toBeUndefined()
  })
})
