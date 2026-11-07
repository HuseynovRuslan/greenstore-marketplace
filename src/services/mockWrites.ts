/**
 * Mock behaviour for the write side of the repository (DATA_SOURCE=mock): numbering, owner statistics and the SMS
 * code. Nothing here sends an SMS or stores anything durable; module state lives as long as the server process.
 * DEMO ONLY — the real API replaces all of it (docs/handoff/contract-additions.md).
 */
import type { Listing, ListingStats, OtpChallenge, OtpVerifyResult } from '@/types'

const counters = new Map<string, number>()

/** Next number of a mock sequence ("Elan № 10540", "Sorğu № 3021"). */
export function mockSequence(name: string, start: number): number {
  const next = (counters.get(name) ?? start - 1) + 1
  counters.set(name, next)
  return next
}

/** Small deterministic generator, so a listing's mock numbers stay the same between requests. */
function seeded(seed: number) {
  let x = seed % 2147483647 || 1
  return () => {
    x = (x * 16807) % 2147483647
    return x / 2147483647
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Owner statistics for a listing: total views from the listing, a 14-day curve, reveals and favourites from it. */
export function mockListingStats(listing: Listing, now = new Date()): ListingStats {
  const random = seeded(listing.number ?? listing.title.length * 97)
  const live = listing.status === 'active'
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now.getTime() - (13 - i) * DAY_MS)
    const base = live ? 6 + Math.round(random() * 14) + (i > 9 ? 4 : 0) : i < 4 ? Math.round(random() * 5) : 0
    return { date: date.toISOString().slice(0, 10), views: base }
  })
  const views = listing.views ?? days.reduce((sum, d) => sum + d.views, 0)
  return {
    views,
    phoneReveals: Math.round(views * (0.12 + random() * 0.08)),
    favourites: Math.round(views * (0.04 + random() * 0.04)),
    viewsByDay: days,
  }
}

/* ---------- SMS code ---------- */

/** DEMO ONLY: the one code the mock accepts. The UI shows it in a demo note; a real API never returns it. */
export const DEMO_OTP_CODE = '1234'
const OTP_TTL_SEC = 300
const OTP_RESEND_SEC = 60
const OTP_ATTEMPTS = 5
/** A verified challenge is accepted by register / resetPassword for this long. */
const VERIFIED_TTL_SEC = 30 * 60

const attempts = new Map<string, number>()

const digitsOf = (phone: string) => phone.replace(/\D/g, '').slice(-9)

/** "+994 50 *** ** 34" */
export function maskPhone(phone: string): string {
  const d = digitsOf(phone)
  return d.length === 9 ? `+994 ${d.slice(0, 2)} *** ** ${d.slice(7)}` : '+994 ** *** ** **'
}

/** The challenge id carries the phone and the issue time, so the mock needs no storage to check expiry. */
function parseChallenge(id: string): { issuedAt: number } | undefined {
  const m = /^otp\.(\d{9})\.(\d{10,})$/.exec(id)
  return m ? { issuedAt: Number(m[2]) } : undefined
}

export const mockOtp = {
  request(phone: string, now = Date.now()): OtpChallenge {
    if (digitsOf(phone).length !== 9) throw new Error('invalid phone')
    return {
      challengeId: `otp.${digitsOf(phone)}.${now}`,
      phoneMasked: maskPhone(phone),
      expiresInSec: OTP_TTL_SEC,
      resendInSec: OTP_RESEND_SEC,
      demoCode: DEMO_OTP_CODE,
    }
  },
  verify(challengeId: string, code: string, now = Date.now()): OtpVerifyResult {
    const challenge = parseChallenge(challengeId)
    if (!challenge || now - challenge.issuedAt > OTP_TTL_SEC * 1000) return { ok: false, error: 'expired' }
    const used = attempts.get(challengeId) ?? 0
    if (used >= OTP_ATTEMPTS) return { ok: false, error: 'too-many-attempts', attemptsLeft: 0 }
    if (code.trim() !== DEMO_OTP_CODE) {
      attempts.set(challengeId, used + 1)
      const left = OTP_ATTEMPTS - used - 1
      return left > 0 ? { ok: false, error: 'wrong-code', attemptsLeft: left } : { ok: false, error: 'too-many-attempts', attemptsLeft: 0 }
    }
    return { ok: true }
  },
  /** Mock stand-in for "this challenge was verified": well-formed and recent. */
  isVerified(challengeId: string, now = Date.now()): boolean {
    const challenge = parseChallenge(challengeId)
    return Boolean(challenge && now - challenge.issuedAt <= VERIFIED_TTL_SEC * 1000)
  },
}
