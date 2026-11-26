/**
 * Pre-hydration state for the header (and the private pages' loading frames).
 *
 * The session and the banner dismissal are known only to the browser before React runs, so server HTML is always the
 * signed-out, banner-visible version. This script runs in <head> before the first paint and marks <html> with what
 * the browser knows:
 *   data-auth="user"         a session exists (plus --gs-user-initials, the letters in the header's avatar:
 *                            initials() in src/lib/format.ts, repeated here; bootstrap.test.ts keeps the two in step)
 *   data-banner="dismissed"  the "Demo versiya" banner was closed in this browser session
 *   data-favorites="some|none"  whether the visitor's favourites list (account or guest) has items
 * Where the session comes from depends on the data source:
 *   DATA_SOURCE=mock  the demo session in localStorage (SESSION_KEY)
 *   DATA_SOURCE=api   the `gs_hint` cookie: the httpOnly `gs_session` cookie holds the token and cannot be read here, so
 *                     the server writes this non-sensitive hint next to it (signed in + the avatar's initials,
 *                     src/services/session.ts). The account's favourites are on the server: unknown here.
 * Until React knows the session, components that depend on it render both variants (classes `auth-user` /
 * `auth-guest`) and CSS in src/styles/index.css shows the right one, so nothing flips after hydration.
 * See Next.js "Preventing flash before hydration" (node_modules/next/dist/docs/01-app/02-guides).
 */
import type { DataSource } from '@/seo/env'

export const SESSION_KEY = 'greenstore:session'
export const BANNER_DISMISSED_KEY = 'greenstore:demo-banner-dismissed'
export const GUEST_FAVORITES_KEY = 'greenstore:favorites:guest'
/** Signed-in favourites; a missing key means the seeded Figma list (never empty). */
export const ACCOUNT_FAVORITES_KEY = 'greenstore:favorites:account'

/** DATA_SOURCE=api: the session token (httpOnly, never readable by scripts). */
export const SESSION_COOKIE = 'gs_session'
/** DATA_SOURCE=api: «signed in» and the avatar's initials, readable by the pre-hydration script. No token, no name. */
export const SESSION_HINT_COOKIE = 'gs_hint'

/**
 * What `gs_hint` holds: the initials (initials() of the account's name), when the cookies were written (seconds) and
 * whether they end with the browser («Məni xatırla» left unticked: `browserOnly`, written `s: 1`; hints written before
 * Nov 2026 have no `s` and are the 30-day kind).
 */
export interface SessionHint {
  initials: string
  issuedAt: number
  browserOnly?: boolean
}

/** The cookie value (Next.js URI-encodes it once more when it writes the cookie). */
export function encodeSessionHint(hint: SessionHint): string {
  return JSON.stringify(hint.browserOnly ? { i: hint.initials, t: hint.issuedAt, s: 1 } : { i: hint.initials, t: hint.issuedAt })
}

/** `undefined` for anything that is not a hint this site wrote. */
export function decodeSessionHint(value: string | undefined): SessionHint | undefined {
  if (!value) return undefined
  try {
    const raw = JSON.parse(value) as { i?: unknown; t?: unknown; s?: unknown }
    if (typeof raw.i !== 'string' || typeof raw.t !== 'number') return undefined
    return raw.s === 1 ? { initials: raw.i, issuedAt: raw.t, browserOnly: true } : { initials: raw.i, issuedAt: raw.t }
  } catch {
    return undefined
  }
}

/** Whether this browser has a session hint (DATA_SOURCE=api): read from document.cookie. */
export function readSessionHint(cookie: string = typeof document === 'undefined' ? '' : document.cookie): SessionHint | undefined {
  const entry = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_HINT_COOKIE}=`))
  if (!entry) return undefined
  try {
    return decodeSessionHint(decodeURIComponent(entry.slice(SESSION_HINT_COOKIE.length + 1)))
  } catch {
    return undefined
  }
}

const banner = `try{if(JSON.parse(sessionStorage.getItem(${JSON.stringify(BANNER_DISMISSED_KEY)})||"false"))d.setAttribute("data-banner","dismissed")}catch(e){}`
const setInitials = 'd.style.setProperty("--gs-user-initials",JSON.stringify(t))'

/** DATA_SOURCE=mock: the demo session and favourites in localStorage. */
export const PRE_HYDRATION_SCRIPT = `(function(){var d=document.documentElement,s=null;try{s=JSON.parse(localStorage.getItem(${JSON.stringify(SESSION_KEY)})||"null");if(s){d.setAttribute("data-auth","user");var w=String(s.fullName||"").split(/\\s+/).map(function(x){return x.replace(/^[^\\p{L}]+/u,"")}).filter(function(x){return /^\\p{L}/u.test(x)}),c=function(x){return x?Array.from(x)[0]:""},t=w.length>1?c(w[0])+c(w[1]):c(w[0]);t=t.replace(/i/g,"İ").replace(/ı/g,"I").toUpperCase();${setInitials}}}catch(e){}try{var f=s?JSON.parse(localStorage.getItem(${JSON.stringify(ACCOUNT_FAVORITES_KEY)})||"null"):JSON.parse(localStorage.getItem(${JSON.stringify(GUEST_FAVORITES_KEY)})||"[]");d.setAttribute("data-favorites",(s&&f===null)||(f&&f.length>0)?"some":"none")}catch(e){}${banner}})()`

/**
 * DATA_SOURCE=api: the session hint cookie (initials computed by the server with initials()); a guest's favourites are
 * in localStorage, an account's on the server (left unmarked: CSS then shows the "some" variant).
 */
export const API_PRE_HYDRATION_SCRIPT = `(function(){var d=document.documentElement,h=null;try{var m=document.cookie.match(/(?:^|;\\s*)${SESSION_HINT_COOKIE}=([^;]*)/);if(m){h=JSON.parse(decodeURIComponent(m[1]));if(h&&typeof h.i==="string"){d.setAttribute("data-auth","user");var t=h.i==="?"?"":h.i;${setInitials}}else h=null}}catch(e){h=null}try{if(!h){var f=JSON.parse(localStorage.getItem(${JSON.stringify(GUEST_FAVORITES_KEY)})||"[]");d.setAttribute("data-favorites",f&&f.length>0?"some":"none")}}catch(e){}${banner}})()`

/** The script for this deployment's data source (the root layout renders it). */
export function preHydrationScript(source: DataSource): string {
  return source === 'api' ? API_PRE_HYDRATION_SCRIPT : PRE_HYDRATION_SCRIPT
}

/** Class for an element that is only rendered before hydration, for one of the two session states. */
export const preHydrationClass = (variant: 'user' | 'guest') => (variant === 'user' ? 'auth-user' : 'auth-guest')
