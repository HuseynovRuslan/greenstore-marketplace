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

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

/** Azerbaijani-aware, case/diacritic-insensitive normalisation for client-side search. */
export function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('az')
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
