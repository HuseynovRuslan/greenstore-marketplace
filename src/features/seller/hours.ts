import type { OpeningHours, SellerOffer } from '@/types'

/* Opening hours and offers of a business page (Nov 2026 contract additions). Pure, so they can be tested. */

export const DAY_NAMES = ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'] as const
const DAY_SHORT = ['B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.', 'B.'] as const

export const offerLabels: Record<SellerOffer, string> = {
  delivery: 'Çatdırılma',
  planting: 'Yerində əkin',
  design: 'Landşaft dizaynı',
  wholesale: 'Topdan satış',
  care: 'Qulluq məsləhəti',
}

const span = (h: OpeningHours) => (h.closed || !h.open || !h.close ? 'Bağlıdır' : `${h.open}–${h.close}`)

export interface HoursRow {
  /** «Hər gün», «B.e.–C.», «Ş.» */
  days: string
  time: string
  /** Weekdays (1–7) the row covers, to mark today */
  dayNumbers: number[]
}

/** Consecutive days with the same hours become one row: «B.e.–C. 10:00–20:00», «Ş. 10:00–14:00», «B. Bağlıdır». */
export function groupHours(hours: OpeningHours[]): HoursRow[] {
  const byDay = new Map(hours.map((h) => [h.day, h]))
  const rows: HoursRow[] = []
  for (let day = 1; day <= 7; day++) {
    const h = byDay.get(day as OpeningHours['day'])
    const time = h ? span(h) : 'Bağlıdır'
    const last = rows[rows.length - 1]
    if (last && last.time === time && last.dayNumbers[last.dayNumbers.length - 1] === day - 1) last.dayNumbers.push(day)
    else rows.push({ days: '', time, dayNumbers: [day] })
  }
  for (const r of rows) {
    const first = r.dayNumbers[0]
    const end = r.dayNumbers[r.dayNumbers.length - 1]
    r.days = r.dayNumbers.length === 7 ? 'Hər gün' : first === end ? DAY_SHORT[first - 1] : `${DAY_SHORT[first - 1]}–${DAY_SHORT[end - 1]}`
  }
  return rows
}

/* Locative suffix of a time read aloud («09:00-da» = doqquzda, «11:00-də» = on birdə, «09:30-da» = otuzda). */
const UNIT_BACK = new Set([6, 9]) // altı, doqquz
const TENS_BACK = new Set([1, 3, 4]) // on, otuz, qırx
function numberBack(n: number): boolean {
  if (n % 10) return UNIT_BACK.has(n % 10)
  return n === 0 || TENS_BACK.has(n / 10) // sıfır → da
}
export function atTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${hhmm}-${numberBack(m ? m : h) ? 'da' : 'də'}`
}

const BAKU_OFFSET_MIN = 4 * 60
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Weekday (1 = Monday) and minutes since midnight in Baku time (UTC+4, no daylight saving). */
export function bakuClock(now: Date): { day: number; minute: number } {
  const t = new Date(now.getTime() + BAKU_OFFSET_MIN * 60_000)
  const js = t.getUTCDay()
  return { day: js === 0 ? 7 : js, minute: t.getUTCHours() * 60 + t.getUTCMinutes() }
}

/** «İndi açıqdır · 18:00-dək» / «Bağlıdır · sabah 09:00-da açılır» / «Bağlıdır · Bazar ertəsi 09:00-da açılır». */
export function openStatus(hours: OpeningHours[], now: Date): { open: boolean; label: string } {
  const { day, minute } = bakuClock(now)
  const of = (d: number) => hours.find((h) => h.day === d)
  const today = of(day)
  if (today && !today.closed && today.open && today.close) {
    if (minute >= minutes(today.open) && minute < minutes(today.close)) return { open: true, label: `İndi açıqdır · ${today.close}-dək` }
    if (minute < minutes(today.open)) return { open: false, label: `Bağlıdır · bu gün ${atTime(today.open)} açılır` }
  }
  for (let i = 1; i <= 7; i++) {
    const d = ((day - 1 + i) % 7) + 1
    const h = of(d)
    if (h && !h.closed && h.open) return { open: false, label: `Bağlıdır · ${i === 1 ? 'sabah' : DAY_NAMES[d - 1]} ${atTime(h.open)} açılır` }
  }
  return { open: false, label: 'Bağlıdır' }
}

/** Google Maps link for a pin (opens the app on phones). */
export const mapHref = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
