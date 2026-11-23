import { isIP } from 'node:net'

/**
 * The visitor's IP for the API's per-IP limits (SMS codes, wrong passwords, anonymous writes), taken only from what the
 * hosting in front of Next.js writes, never from what a browser can send (README.md «Visitor IP»).
 *
 * Next.js itself fills `X-Forwarded-For` with the connection's address only when the request has none
 * (next/dist/server/base-server.js), so the first entry is whatever the visitor typed, and so is the whole header when
 * nothing in front of Next.js overwrites or appends to it. Hence:
 * - `CLIENT_IP_HEADER` set (`x-vercel-forwarded-for` on Vercel, `cf-connecting-ip` behind Cloudflare, `x-real-ip` when
 *   nginx has `proxy_set_header X-Real-IP $remote_addr`, `fly-client-ip` on Fly.io): that one header, which the host
 *   overwrites on every request.
 * - else `X-Forwarded-For` read from the right: each trusted proxy appends the address it was reached from, so the
 *   entry `TRUSTED_PROXY_HOPS` places from the end (default 1: the last one) is the address the outermost trusted
 *   proxy saw. Vercel overwrites the header with the visitor's address alone, so 1 fits it too. A list shorter than
 *   that did not come through every trusted proxy: no IP then.
 * - `TRUSTED_PROXY_HOPS=0`: nothing is trusted and no IP is passed, so the API counts the Next.js server's address.
 *
 * Next.js must not be reachable from the internet except through the proxies counted here: a visitor who reaches
 * `next start` directly chooses the header.
 */
export function clientIpOf(requestHeaders: Pick<Headers, 'get'>, env: Record<string, string | undefined> = process.env): string | undefined {
  const header = env.CLIENT_IP_HEADER?.trim().toLowerCase()
  if (header) return address(requestHeaders.get(header) ?? undefined)

  warnUnconfigured(env)
  const hops = trustedHops(env.TRUSTED_PROXY_HOPS)
  if (hops === 0) return undefined
  const entries = (requestHeaders.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return entries.length >= hops ? address(entries[entries.length - hops]) : undefined
}

let warned = false

/**
 * A self-hosted production server (not Vercel, which overwrites the header) that names neither setting is told once in
 * its log what the default trusts, so the deployment's proxy gets checked.
 */
function warnUnconfigured(env: Record<string, string | undefined>): void {
  if (warned || env.NODE_ENV !== 'production' || env.VERCEL === '1' || env.TRUSTED_PROXY_HOPS?.trim()) return
  warned = true
  console.warn(
    'GreenStore: CLIENT_IP_HEADER and TRUSTED_PROXY_HOPS are not set, so the visitor IP sent to the API is the last X-Forwarded-For entry. ' +
      'Make sure the proxy in front of Next.js appends or overwrites that header, or set one of them (README.md, "Visitor IP behind the hosting\'s proxy").',
  )
}

/** `TRUSTED_PROXY_HOPS`: a whole number from 0; unset or anything else is 1. */
function trustedHops(value: string | undefined): number {
  const hops = Number(value?.trim() || '1')
  return Number.isInteger(hops) && hops >= 0 ? hops : 1
}

/** An IPv4 or IPv6 address, without the port or brackets some proxies add ("203.0.113.7:51234", "[2001:db8::1]:443"). */
function address(value: string | undefined): string | undefined {
  const raw = value?.trim()
  if (!raw) return undefined
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(raw)
  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(raw)
  const ip = bracketed?.[1] ?? ipv4WithPort?.[1] ?? raw
  return isIP(ip) ? ip : undefined
}
