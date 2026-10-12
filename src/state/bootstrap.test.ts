import { afterEach, describe, expect, it } from 'vitest'
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
    html.style.removeProperty('--gs-user-name')
  })

  it('leaves <html> alone for a guest with the banner visible', () => {
    run()
    expect(html.hasAttribute('data-auth')).toBe(false)
    expect(html.hasAttribute('data-banner')).toBe(false)
  })

  it('marks a stored demo session and exposes the name to CSS', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ fullName: 'Elvin Əliyev', sellerId: 'abseron-tingcilik' }))
    run()
    expect(html.getAttribute('data-auth')).toBe('user')
    expect(html.style.getPropertyValue('--gs-user-name')).toBe('"Elvin Əliyev"')
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
