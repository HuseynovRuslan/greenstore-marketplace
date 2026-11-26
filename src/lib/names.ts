/**
 * People's names as the forms take them («Ad», «Soyad», «Adınız»): letters of any alphabet (ə, ğ, ı, ö, ş, ü, ç too)
 * with a space, a hyphen (Məmməd-Əli), an apostrophe or a dot (an initial) between them. Digits and other symbols
 * are dropped as they are typed or pasted, and the API refuses them too (PersonNames.cs).
 */

const NOT_NAME = /[^\p{L}\p{M} '’.-]/gu
const NAME = /^[\p{L}\p{M}](?:[\p{L}\p{M} '’.-]*[\p{L}\p{M}.])?$/u

/**
 * Each of «Ad» and «Soyad» at most: joined with a space they fit the API's 60 characters of `fullName` and
 * `contactPerson`.
 */
export const NAME_PART_MAX = 29

/** What a name field keeps of the typed or pasted text: no digits or symbols, one space between words, none in front. */
export function nameChars(value: string): string {
  return value.replace(/\s+/g, ' ').replace(NOT_NAME, '').replace(/ {2,}/g, ' ').replace(/^[ '’.-]+/, '')
}

/** A whole name: starts with a letter, letters with single separators, no digits or symbols. */
export function isPersonName(value: string): boolean {
  return NAME.test(value.trim())
}

/** "Sərxan Əşrəfzadə" → { first: 'Sərxan', last: 'Əşrəfzadə' }; the first word is the name, the rest the surname. */
export function splitFullName(full: string): { first: string; last: string } {
  const name = full.trim().replace(/\s+/g, ' ')
  const space = name.indexOf(' ')
  return space < 0 ? { first: name, last: '' } : { first: name.slice(0, space), last: name.slice(space + 1) }
}

/** «Ad» and «Soyad» → the one `fullName` the API keeps. */
export function joinFullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ')
}

/** The error of «Ad» or «Soyad» (`what`: «Adınızı», «Soyadınızı»), or undefined. */
export function namePartError(value: string, what: 'Adınızı' | 'Soyadınızı'): string | undefined {
  const name = value.trim()
  if (!name) return `${what} yazın.`
  return isPersonName(name) ? undefined : `${what} yalnız hərflərlə yazın.`
}
