import { describe, expect, it, vi } from 'vitest'
import { clientIpOf } from '@/services/clientIp'

const ip = (headers: Record<string, string>, env: Record<string, string | undefined> = {}) => clientIpOf(new Headers(headers), env)

describe('clientIpOf: the visitor’s IP for the API’s limits', () => {
  it('takes the last X-Forwarded-For entry by default: the one the hosting’s proxy added', () => {
    expect(ip({ 'x-forwarded-for': '198.51.100.4' })).toBe('198.51.100.4')
    // A browser sent its own header first; the proxy appended the real address.
    expect(ip({ 'x-forwarded-for': '203.0.113.5, 198.51.100.4' })).toBe('198.51.100.4')
    expect(ip({ 'x-forwarded-for': ' 203.0.113.5 ,2001:db8::1 ' })).toBe('2001:db8::1')
  })

  it('counts TRUSTED_PROXY_HOPS proxies from the right', () => {
    const headers = { 'x-forwarded-for': '203.0.113.5, 198.51.100.4, 10.0.0.2' }
    expect(ip(headers, { TRUSTED_PROXY_HOPS: '2' })).toBe('198.51.100.4')
    expect(ip(headers, { TRUSTED_PROXY_HOPS: '3' })).toBe('203.0.113.5')
    // Fewer entries than proxies: the request did not come through all of them.
    expect(ip({ 'x-forwarded-for': '198.51.100.4' }, { TRUSTED_PROXY_HOPS: '2' })).toBeUndefined()
  })

  it('passes no IP with TRUSTED_PROXY_HOPS=0, and reads an unusable value as 1', () => {
    expect(ip({ 'x-forwarded-for': '198.51.100.4' }, { TRUSTED_PROXY_HOPS: '0' })).toBeUndefined()
    expect(ip({ 'x-forwarded-for': '203.0.113.5, 198.51.100.4' }, { TRUSTED_PROXY_HOPS: '-1' })).toBe('198.51.100.4')
    expect(ip({ 'x-forwarded-for': '203.0.113.5, 198.51.100.4' }, { TRUSTED_PROXY_HOPS: 'many' })).toBe('198.51.100.4')
  })

  it('reads only CLIENT_IP_HEADER when it is set', () => {
    const env = { CLIENT_IP_HEADER: 'CF-Connecting-IP' }
    expect(ip({ 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': '203.0.113.5' }, env)).toBe('198.51.100.4')
    expect(ip({ 'x-forwarded-for': '203.0.113.5' }, env)).toBeUndefined()
  })

  it('never trusts X-Real-IP unless the deployment names it', () => {
    expect(ip({ 'x-real-ip': '203.0.113.5' })).toBeUndefined()
    expect(ip({ 'x-real-ip': '198.51.100.4' }, { CLIENT_IP_HEADER: 'x-real-ip' })).toBe('198.51.100.4')
  })

  it('drops ports and brackets, and refuses what is not an address', () => {
    expect(ip({ 'x-forwarded-for': '198.51.100.4:51234' })).toBe('198.51.100.4')
    expect(ip({ 'x-forwarded-for': '[2001:db8::1]:443' })).toBe('2001:db8::1')
    expect(ip({ 'x-forwarded-for': 'unknown' })).toBeUndefined()
    expect(ip({ 'x-forwarded-for': '198.51.100.4, <script>' })).toBeUndefined()
    expect(ip({})).toBeUndefined()
  })
})

describe('clientIpOf: an unconfigured self-hosted server', () => {
  it('says once in the log what the default trusts', async () => {
    vi.resetModules()
    const { clientIpOf: fresh } = await import('@/services/clientIp')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const headers = new Headers({ 'x-forwarded-for': '198.51.100.4' })
      fresh(headers, { NODE_ENV: 'production', VERCEL: '1' })
      fresh(headers, { NODE_ENV: 'production', TRUSTED_PROXY_HOPS: '1' })
      fresh(headers, { NODE_ENV: 'development' })
      expect(warn).not.toHaveBeenCalled()
      expect(fresh(headers, { NODE_ENV: 'production' })).toBe('198.51.100.4')
      fresh(headers, { NODE_ENV: 'production' })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toMatch(/TRUSTED_PROXY_HOPS/)
    } finally {
      warn.mockRestore()
    }
  })
})
