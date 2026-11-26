/**
 * The signed-in session of DATA_SOURCE=api (backend-contract.md 2.1), kept in two cookies the Next.js server writes:
 *
 * - `gs_session`: the API's session token. httpOnly (no script can read it), Secure in production, SameSite=Lax,
 *   30 days. apiRepository sends it as `Authorization: Bearer <token>`; the browser never sees the token otherwise.
 * - `gs_hint`: not sensitive — «signed in» and the avatar's initials, for the first paint before React runs
 *   (src/state/bootstrap.ts). Same lifetime; readable by scripts.
 *
 * The API extends a session by 30 days from its last use. The cookies are written again (another 30 days) when they are
 * a day old and the visitor comes back (`refreshSession`), so both stay in step without a write on every request.
 *
 * «Məni xatırla» left unticked (`untilBrowserCloses`): both cookies are written as browser-session cookies (no
 * Max-Age), which the browser deletes when it is closed; the hint remembers that, so a refresh keeps them that way.
 * The token still never reaches a script. The API's own session is not shortened (it has no such option): it goes
 * unused and expires 30 days after its last use.
 *
 * Cookies can only be written in Server Actions and Route Handlers: outside them (a page render) writes are skipped.
 */
import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { cookies } from 'next/headers'
import { initials } from '@/lib/format'
import { decodeSessionHint, encodeSessionHint, SESSION_COOKIE, SESSION_HINT_COOKIE } from '@/state/bootstrap'

/** The session the API opened: `token` goes into the cookie, nowhere else. */
export interface SessionGrant {
  id: string
  token: string
  expiresAt: string
}

export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60
/** How old the cookies may get before a visit writes them again. */
const REFRESH_AFTER_SEC = 24 * 60 * 60

const nowSec = () => Math.floor(Date.now() / 1000)

/** Set for the length of a sign-in whose session should end with the browser (see `untilBrowserCloses`). */
const browserOnlySignIn = new AsyncLocalStorage<true>()

/**
 * Runs a sign-in («Məni xatırla» unticked) so that the session it stores ends with the browser: `storeSession`,
 * called by the repository deep inside, writes cookies without Max-Age. Request-scoped, so concurrent sign-ins of
 * other visitors are not affected, and the repository's contract does not change.
 */
export function untilBrowserCloses<T>(signIn: () => Promise<T>): Promise<T> {
  return browserOnlySignIn.run(true, signIn)
}

/** `persistent: false` → a browser-session cookie (no Max-Age): gone when the browser is closed. */
function cookieOptions(httpOnly: boolean, env: Record<string, string | undefined> = process.env, persistent = true) {
  const base = { httpOnly, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' }
  return persistent ? { ...base, maxAge: SESSION_MAX_AGE_SEC } : base
}

/** The token of this request's session, if it has one. */
export async function sessionToken(): Promise<string | undefined> {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value || undefined
  } catch {
    // Outside a request (a build step, a script): nobody is signed in.
    return undefined
  }
}

/**
 * After a sign-in: both cookies, for the account named `fullName`. `browserOnly` (until the browser is closed)
 * defaults to the sign-in's choice made with `untilBrowserCloses`.
 */
export async function storeSession(token: string, fullName: string, browserOnly = browserOnlySignIn.getStore() === true): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, cookieOptions(true, process.env, !browserOnly))
  store.set(SESSION_HINT_COOKIE, encodeSessionHint({ initials: initials(fullName), issuedAt: nowSec(), browserOnly }), cookieOptions(false, process.env, !browserOnly))
}


/**
 * On a visit of a signed-in browser: writes the hint again when the name's initials changed or the hint is missing,
 * and both cookies when they are a day old (the API's session slides; the cookies follow it).
 */
export async function refreshSession(fullName: string): Promise<void> {
  try {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (!token) return
    const hint = decodeSessionHint(store.get(SESSION_HINT_COOKIE)?.value)
    // A browser-only session stays one: rewriting it must not give it 30 days.
    const browserOnly = hint?.browserOnly ?? false
    if (!hint || nowSec() - hint.issuedAt > REFRESH_AFTER_SEC) await storeSession(token, fullName, browserOnly)
    else if (hint.initials !== initials(fullName)) store.set(SESSION_HINT_COOKIE, encodeSessionHint({ ...hint, initials: initials(fullName) }), cookieOptions(false, process.env, !browserOnly))
  } catch {
    // A page render cannot write cookies; the next Server Action will.
  }
}

/** Signed out, or the API no longer knows the session: both cookies go. */
export async function clearSession(): Promise<void> {
  try {
    const store = await cookies()
    store.delete(SESSION_COOKIE)
    store.delete(SESSION_HINT_COOKIE)
  } catch {
    // Outside a Server Action: the cookies stay until the next one (every call answers "signed out" meanwhile).
  }
}

export const sessionCookieOptions = cookieOptions
