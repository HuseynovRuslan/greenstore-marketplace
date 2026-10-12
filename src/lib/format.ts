const AZ_MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avqust',
  'sentyabr',
  'oktyabr',
  'noyabr',
  'dekabr',
]

/** 2480 → "2 480" (thin grouping used throughout the Figma copy) */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** 145 → "145 ₼" */
export function formatPrice(value: number): string {
  return `${formatNumber(value)} ₼`
}

/** "2026-10-12" → "12 oktyabr" */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  return `${day} ${AZ_MONTHS[month - 1]}`
}

/** "2026-10-12" → "12 oktyabr 2026" */
export function formatFullDate(isoDate: string): string {
  const [year] = isoDate.slice(0, 10).split('-')
  return `${formatDayMonth(isoDate)} ${year}`
}

/*
 * Azerbaijani case mapping and alphabetical order, implemented here instead of `toLocaleLowerCase('az')` /
 * `localeCompare(…, 'az')`: pages now render on the server (Node) and in the browser, and their ICU data differ
 * (Chromium orders "Q" after "P"), which would make server and client HTML disagree.
 */
export function lowerAz(value: string): string {
  return value.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase()
}

export function upperAz(value: string): string {
  return value.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase()
}

const AZ_ALPHABET = 'abcçdeəfgğhxıijkqlmnoöprsştuüvyz'
const azRank = new Map([...AZ_ALPHABET].map((ch, i) => [ch, i]))

/** Alphabetical order of the Azerbaijani alphabet (A B C Ç D E Ə F G Ğ H X I İ J K Q L …); other characters by code point. */
export function compareAz(a: string, b: string): number {
  const x = lowerAz(a)
  const y = lowerAz(b)
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] === y[i]) continue
    const rx = azRank.get(x[i])
    const ry = azRank.get(y[i])
    if (rx != null && ry != null) return rx - ry
    if (rx != null) return 1
    if (ry != null) return -1
    return x.charCodeAt(i) - y.charCodeAt(i)
  }
  return x.length - y.length
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Azerbaijani-aware, case/diacritic-insensitive normalisation for client-side search. */
export function normalizeSearch(value: string): string {
  return lowerAz(value)
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
