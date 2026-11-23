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
 * Cookies can only be written in Server Actions and Route Handlers: outside them (a page render) writes are skipped.
 */
import 'server-only'
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

function cookieOptions(httpOnly: boolean, env: Record<string, string | undefined> = process.env) {
  return { httpOnly, secure: env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: SESSION_MAX_AGE_SEC }
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

/** After a sign-in: both cookies, for the account named `fullName`. */
export async function storeSession(token: string, fullName: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, cookieOptions(true))
  store.set(SESSION_HINT_COOKIE, encodeSessionHint({ initials: initials(fullName), issuedAt: nowSec() }), cookieOptions(false))
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
    if (!hint || nowSec() - hint.issuedAt > REFRESH_AFTER_SEC) await storeSession(token, fullName)
    else if (hint.initials !== initials(fullName)) store.set(SESSION_HINT_COOKIE, encodeSessionHint({ initials: initials(fullName), issuedAt: hint.issuedAt }), cookieOptions(false))
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
