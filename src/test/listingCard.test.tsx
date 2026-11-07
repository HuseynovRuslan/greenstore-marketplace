import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListingCard } from '@/components/cards/ListingCard'
import { listings } from '@/data/listings'
import { ListingRow } from '@/features/search/ListingRow'
import { AppStoreProvider } from '@/state/store'

const promoted = listings.find((l) => l.vip && l.status === 'active')!
const plain = listings.find((l) => !l.vip && l.status === 'active')!

const renderIn = (node: ReactNode) => render(<AppStoreProvider>{node}</AppStoreProvider>)

describe.each([
  ['ListingCard', ListingCard],
  ['ListingRow', ListingRow],
])('%s', (_, Card) => {
  beforeEach(() => window.localStorage.clear())

  it('has one link, named by the title, and the favourite button outside it', () => {
    const { container } = renderIn(<Card listing={promoted} />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAccessibleName(promoted.title)
    expect(links[0]).toHaveAttribute('href', `/elanlar/${promoted.slug}`)
    const favourite = screen.getByRole('button', { name: `${promoted.title} — seçilmişlərə əlavə et` })
    expect(favourite.closest('a')).toBeNull()
    // The photo is decorative: the title already names the listing.
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('shows the «Önə çıxan» badge with the rocket only on promoted listings', () => {
    const { unmount } = renderIn(<Card listing={promoted} />)
    const badges = screen.getAllByText('Önə çıxan')
    expect(badges.length).toBeGreaterThan(0)
    expect(badges[0].parentElement?.querySelector('svg')).not.toBeNull()
    unmount()
    renderIn(<Card listing={plain} />)
    expect(screen.queryByText('Önə çıxan')).not.toBeInTheDocument()
  })

  it('zooms its photo on its own hover only', () => {
    // The results section is a group too: with a plain `group-hover`, hovering one card zoomed every photo.
    const { container } = renderIn(<Card listing={plain} />)
    expect(screen.getByRole('article')).toHaveClass('group/card')
    const img = container.querySelector('img')!
    expect(img).toHaveClass('motion-safe:group-hover/card:scale-[1.03]')
    expect(img.className).not.toMatch(/group-hover:/)
  })

  it('toggles the favourite without following the link', async () => {
    const user = userEvent.setup()
    renderIn(<Card listing={plain} />)
    await user.click(screen.getByRole('button', { name: /seçilmişlərə əlavə et/ }))
    expect(screen.getByRole('button', { name: /seçilmişlərdən çıxar/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('card dates', () => {
  it('gives the card a relative date and the list row the full date', () => {
    const { unmount } = renderIn(<ListingCard listing={plain} />)
    const cardDate = screen.getByText(/əvvəl$|^bu gün$|^dünən$/)
    expect(cardDate.tagName).toBe('TIME')
    expect(cardDate).toHaveAttribute('dateTime', plain.publishedAt)
    unmount()
    renderIn(<ListingRow listing={plain} />)
    const row = screen.getByRole('article')
    expect(within(row).getByText('12 oktyabr 2026')).toHaveAttribute('dateTime', plain.publishedAt)
  })
})
