import { describe, expect, it } from 'vitest'
import { isPersonName, joinFullName, nameChars, namePartError, splitFullName } from '@/lib/names'

describe('name fields', () => {
  it.each([
    ['Elvin2', 'Elvin'],
    ['1Sərxan', 'Sərxan'],
    ['Əli@ Rza', 'Əli Rza'],
    ['Əli  1 Rza', 'Əli Rza'],
    ['  Nigar', 'Nigar'],
    ['-Nigar', 'Nigar'],
    ['Məmməd-Əli', 'Məmməd-Əli'],
    ['S. Əşrəfzadə', 'S. Əşrəfzadə'],
    ['Elvin ', 'Elvin '],
  ])('keeps letters of %j: %j', (typed, kept) => {
    expect(nameChars(typed)).toBe(kept)
  })

  it.each([
    ['Sərxan Əşrəfzadə', true],
    ['İlqar', true],
    ['O’Neil', true],
    ['Nigar R.', true],
    ['Elvin 2', false],
    ['050 555 12 34', false],
    ['-', false],
    ['', false],
  ])('%j is a name: %s', (name, valid) => {
    expect(isPersonName(name)).toBe(valid)
  })

  it('splits the API’s one name into «Ad» and «Soyad» and joins them back', () => {
    expect(splitFullName('Sərxan Əşrəfzadə')).toEqual({ first: 'Sərxan', last: 'Əşrəfzadə' })
    expect(splitFullName(' Elvin  Əli oğlu ')).toEqual({ first: 'Elvin', last: 'Əli oğlu' })
    expect(splitFullName('Sabuhi')).toEqual({ first: 'Sabuhi', last: '' })
    expect(joinFullName(' Sərxan ', 'Əşrəfzadə ')).toBe('Sərxan Əşrəfzadə')
    expect(joinFullName('Sabuhi', '')).toBe('Sabuhi')
  })

  it('says what to write', () => {
    expect(namePartError('', 'Adınızı')).toBe('Adınızı yazın.')
    expect(namePartError('  ', 'Soyadınızı')).toBe('Soyadınızı yazın.')
    expect(namePartError('Elvin', 'Adınızı')).toBeUndefined()
  })
})
