/**
 * Seller cabinet figures from Figma "Şəxsi kabinet · 1440" (Abşeron Tingçilik).
 * These are server-side totals in the design — the listing rows below are only the first page of them.
 */

/** "Hesab göstəriciləri" tiles */
export const dashboardStats = {
  /** "Aktiv elanlar" */
  active: 24,
  /** "Yoxlamada olanlar" */
  pending: 1,
  /** "Müddəti bitmiş elanlar" */
  expired: 2,
  /** "Son 30 günün baxışları" */
  views30d: 1284,
}

/** "Hamısı · 27 / Aktiv · 24 / Yoxlamada · 1 / Müddəti bitib · 2" */
export const dashboardTotals = {
  all: 27,
  active: dashboardStats.active,
  pending: dashboardStats.pending,
  expired: dashboardStats.expired,
}

/**
 * "Elanlarım" rows in Figma order. The meta line is specific to this frame
 * ("№ 10362 · Abşeron · 10 oktyabr 2026 · 176 baxış"), so date and views are kept here
 * rather than taken from the public listing data. `views: null` renders "— baxış".
 */
export const dashboardRows: Array<{ listingId: string; date: string; views: number | null }> = [
  { listingId: 'zeytun-agaci', date: '2026-10-12', views: 248 },
  { listingId: 'tuya-smaragd', date: '2026-10-10', views: 176 },
  { listingId: 'leyland-servi-120', date: '2026-10-12', views: null },
  { listingId: 'lavanda-fidani', date: '2026-09-12', views: 92 },
]

/** "Elan statistikası" panel */
export const weeklyStats = {
  title: 'Elan statistikası',
  period: 'Son 7 gün · 6–12 oktyabr',
  /** "Baxış qrafiki" — bar heights in px from the frame (chart area 140 px, bars + 8 px gap + 17 px label). */
  days: [
    { label: '6 okt.', value: 44 },
    { label: '7 okt.', value: 66 },
    { label: '8 okt.', value: 53 },
    { label: '9 okt.', value: 84 },
    { label: '10 okt.', value: 70 },
    { label: '11 okt.', value: 96 },
    { label: '12 okt.', value: 112 },
  ],
  summary: '604 baxış · 42 nömrə göstərilməsi · əvvəlki həftədən 18% çox',
}
