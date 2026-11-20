import { afterEach, describe, expect, it } from 'vitest'
import { initials } from '@/lib/format'
import { ACCOUNT_FAVORITES_KEY, BANNER_DISMISSED_KEY, GUEST_FAVORITES_KEY, PRE_HYDRATION_SCRIPT, SESSION_KEY } from './bootstrap'

const html = document.documentElement
const run = () => new Function(PRE_HYDRATION_SCRIPT)()

describe('pre-hydration script', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    html.removeAttribute('data-auth')
    html.removeAttribute('data-banner')
    html.removeAttribute('data-favorites')
    html.style.removeProperty('--gs-user-initials')
  })

  it('leaves <html> alone for a guest with the banner visible', () => {
    run()
    expect(html.hasAttribute('data-auth')).toBe(false)
    expect(html.hasAttribute('data-banner')).toBe(false)
  })

  it("marks a stored demo session and exposes the avatar's initials to CSS", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ fullName: 'Elvin Əliyev', sellerId: 'abseron-tingcilik' }))
    run()
    expect(html.getAttribute('data-auth')).toBe('user')
    expect(html.style.getPropertyValue('--gs-user-initials')).toBe('"EƏ"')
  })

  it('computes the same initials as initials() in lib/format, which the header uses once hydrated', () => {
    const initialsBeforeHydration = (fullName: unknown) => {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ fullName }))
      run()
      return JSON.parse(html.style.getPropertyValue('--gs-user-initials')) as string
    }
    for (const name of ['Elvin Əliyev', 'ilqar ışıqlı', 'Şəhla', '  Nigar   Rzayeva  Kamal qızı ', '«Yaşıl Ev» MMC', '4 Fəsil Bağ', 'Ögtay-Əli Ünsal', '𝒜lpha Beta']) {
      expect(initialsBeforeHydration(name)).toBe(initials(name))
    }
    // No letter at all: the avatar shows a person icon once hydrated (initials() says "?"), nothing before.
    expect(initialsBeforeHydration('  ')).toBe('')
    expect(initialsBeforeHydration(undefined)).toBe('')
  })

  it('treats a signed-out session (null) and corrupt storage as a guest', () => {
    localStorage.setItem(SESSION_KEY, 'null')
    run()
    expect(html.hasAttribute('data-auth')).toBe(false)
    localStorage.setItem(SESSION_KEY, '{not json')
    expect(run).not.toThrow()
    expect(html.hasAttribute('data-auth')).toBe(false)
  })

  it('follows the banner dismissal stored for the session', () => {
    sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true')
    run()
    expect(html.getAttribute('data-banner')).toBe('dismissed')
  })

  it("records whether the visitor's favourites list has items", () => {
    run()
    expect(html.getAttribute('data-favorites')).toBe('none') // guest, nothing saved
    localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(['listing:zeytun-agaci']))
    run()
    expect(html.getAttribute('data-favorites')).toBe('some')
    localStorage.setItem(SESSION_KEY, JSON.stringify({ fullName: 'Elvin Əliyev' }))
    run()
    expect(html.getAttribute('data-favorites')).toBe('some') // account list not stored yet → seeded Figma list
    localStorage.setItem(ACCOUNT_FAVORITES_KEY, '[]')
    run()
    expect(html.getAttribute('data-favorites')).toBe('none')
  })
})
