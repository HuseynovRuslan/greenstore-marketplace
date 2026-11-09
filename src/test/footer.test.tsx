import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FooterNav } from '@/components/layout/FooterNav'
import { FOOTER_CATEGORY_LIMIT, footerGroups, legalLinks, socialLinks } from '@/components/layout/footerLinks'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { categories } from '@/data/categories'
import { cities } from '@/data/cities'
import { accountTypeFromParam, signUpHref } from '@/features/auth/validation'
import { contactHref, topicFromParam } from '@/features/support/contactTopics'
import type { Category } from '@/types'

const group = (id: string, groups = footerGroups()) => groups.find((g) => g.id === id)!

describe('footer links', () => {
  it('lists the categories of the home page in their order, with their real URLs', () => {
    const kat = group('kateqoriyalar')
    expect(kat.links.map((l) => l.label)).toEqual(categories.slice(0, FOOTER_CATEGORY_LIMIT).map((c) => c.name))
    expect(kat.links[0]).toEqual({ label: 'Ağaclar', href: '/kateqoriyalar/agaclar' })
    // The services umbrella opens the services catalogue, as on the home page
    expect(kat.links.find((l) => l.label === 'Bağ xidmətləri')?.href).toBe('/xidmetler')
    expect(kat.more).toBeUndefined()
  })

  it('shows at most 10 categories, then «Bütün kateqoriyalar»', () => {
    const many: Category[] = [...categories, { ...categories[0], id: 'kaktuslar', slug: 'kaktuslar', name: 'Kaktuslar' }]
    const kat = group('kateqoriyalar', footerGroups({ categories: many }))
    expect(kat.links).toHaveLength(10)
    expect(kat.links.map((l) => l.label)).not.toContain('Kaktuslar')
    expect(kat.more).toEqual({ label: 'Bütün kateqoriyalar', href: '/#kateqoriyalar' })
  })

  it('links each city to the catalogue filtered by it', () => {
    expect(group('seherler').links).toEqual(cities.map((c) => ({ label: c.name, href: `/elanlar?seher=${c.id}` })))
  })

  it('uses the real routes for sellers, help, company and legal pages', () => {
    const hrefs = (id: string) => Object.fromEntries(group(id).links.map((l) => [l.label, l.href]))
    expect(hrefs('saticilar')).toEqual({
      'Elan yerləşdir': '/elan-yerlesdir',
      'Önə çıxar': '/reklam#one-cixar',
      'İrəli çək': '/reklam#ireli-cek',
      'Biznes hesabları': '/qeydiyyat?hesab=biznes',
      'Elan qaydaları': '/qaydalar',
    })
    expect(hrefs('komek')).toEqual({ 'Tez-tez verilən suallar': '/komek', 'Təhlükəsiz alış': '/tehlukesiz-alis', 'Problem bildir': '/elaqe?movzu=sikayet' })
    expect(hrefs('sirket')).toEqual({ Haqqımızda: '/haqqimizda', 'Bitkiyə qulluq məsləhətləri': '/bitkiye-qulluq', Əlaqə: '/elaqe' })
    expect(legalLinks.map((l) => l.href)).toEqual(['/istifade-sertleri', '/mexfilik', '/sayt-xeritesi'])
  })

  it('reads the topic and account-type parameters those links set', () => {
    expect(topicFromParam(new URL(contactHref('complaint'), 'https://x.az').searchParams.get('movzu'))).toBe('complaint')
    expect(topicFromParam('naməlum')).toBeUndefined()
    expect(accountTypeFromParam(new URL(signUpHref('business'), 'https://x.az').searchParams.get('hesab'))).toBe('business')
    expect(accountTypeFromParam(undefined)).toBeUndefined()
  })
})

describe('social links', () => {
  it('stay hidden until a real https URL is set', () => {
    expect(socialLinks({})).toEqual([])
    expect(socialLinks({ NODE_ENV: 'production' })).toEqual([])
    expect(
      socialLinks({
        NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL: 'https://www.instagram.com/greenstore.az',
        NEXT_PUBLIC_SOCIAL_FACEBOOK_URL: 'http://facebook.com/greenstore',
        NEXT_PUBLIC_SOCIAL_TIKTOK_URL: 'javascript:alert(1)',
        NEXT_PUBLIC_SOCIAL_WHATSAPP_URL: '  ',
      }),
    ).toEqual([{ network: 'instagram', name: 'Instagram', href: 'https://www.instagram.com/greenstore.az' }])
  })

  it('get placeholders in `next dev` only', () => {
    expect(socialLinks({ NODE_ENV: 'development' }).map((s) => s.network)).toEqual(['instagram', 'facebook', 'tiktok', 'whatsapp'])
    expect(socialLinks({ NODE_ENV: 'test' })).toEqual([])
  })
})

describe('SiteFooter', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is one contentinfo landmark whose groups are h2 headings; the sellers card is not a heading', () => {
    render(<SiteFooter />)
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
    // Phones and wider screens each have their own h2 per group (one is display:none at any width).
    const titles = new Set(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
    expect([...titles]).toEqual(['Kateqoriyalar', 'Şəhərlər', 'Satıcılar üçün', 'Kömək', 'Şirkət'])
    expect(screen.queryByRole('heading', { name: /Bitki satırsınız/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Elan yerləşdir' })).toHaveAttribute('href', '/elan-yerlesdir')
    expect(screen.getByRole('link', { name: 'Tanıtım paketləri' })).toHaveAttribute('href', '/reklam')
    expect(screen.getByRole('link', { name: 'GreenStore — ana səhifə' })).toHaveClass('text-white')
    expect(screen.queryByRole('list', { name: 'Sosial şəbəkələr' })).toBeNull()
  })

  it('shows a brand icon link (new tab, icon hidden from screen readers) once its URL is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SOCIAL_WHATSAPP_URL', 'https://wa.me/994125554040')
    render(<SiteFooter />)
    const list = screen.getByRole('list', { name: 'Sosial şəbəkələr' })
    const link = within(list).getByRole('link', { name: 'GreenStore WhatsApp-da (yeni pəncərədə açılır)' })
    expect(link).toHaveAttribute('href', 'https://wa.me/994125554040')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    const icon = link.querySelector('svg')!
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(icon).toHaveAttribute('width', '19')
    expect(icon).toHaveAttribute('fill', 'currentColor')
    expect(within(list).getAllByRole('link')).toHaveLength(1)
  })
})

describe('FooterNav (phone accordions)', () => {
  it('opens «Kateqoriyalar» by default and toggles each group on its own', async () => {
    const user = userEvent.setup()
    render(<FooterNav groups={footerGroups()} />)
    const kat = screen.getByRole('button', { name: 'Kateqoriyalar' })
    const seh = screen.getByRole('button', { name: 'Şəhərlər' })
    expect(kat).toHaveAttribute('aria-expanded', 'true')
    expect(seh).toHaveAttribute('aria-expanded', 'false')
    // A closed group's links are in its panel but out of the accessibility tree (visibility: hidden)
    expect(document.getElementById(seh.getAttribute('aria-controls')!)).toContainElement(screen.getByText('Bakı'))
    expect(screen.queryByRole('link', { name: 'Bakı' })).toBeNull()

    await user.click(seh)
    expect(seh).toHaveAttribute('aria-expanded', 'true')
    // Shown by Motion once its lazily loaded bundle is in (jsdom has no CSS for the class fallback)
    expect(await screen.findByRole('link', { name: 'Bakı' })).toHaveAttribute('href', '/elanlar?seher=baki')
    expect(kat).toHaveAttribute('aria-expanded', 'true')
    await user.click(kat)
    expect(kat).toHaveAttribute('aria-expanded', 'false')
  })
})
