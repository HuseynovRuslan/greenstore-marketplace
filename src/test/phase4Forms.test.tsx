import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { ContactForm } from '@/features/support/ContactForm'
import { AppStoreProvider } from '@/state/store'

/*
 * «Bizimlə əlaqə» in the browser (backend-contract.md 4.2): the demo's «Demo: … göndərilmir» note only with
 * DATA_SOURCE=mock. The Server Action is a fake.
 */

vi.setConfig({ testTimeout: 20_000 })

const { sendSupportMessage } = vi.hoisted(() => ({ sendSupportMessage: vi.fn() }))
vi.mock('@/features/support/actions', () => ({ sendSupportMessage }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/xidmetler',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/features/account/actions', () => ({ loadSession: vi.fn(async () => ({ user: undefined })), setFavorite: vi.fn(), mergeFavorites: vi.fn(), signOut: vi.fn() }))

function wrap(source: 'mock' | 'api') {
  return function Store({ children }: { children: ReactNode }) {
    return <AppStoreProvider dataSource={source}>{children}</AppStoreProvider>
  }
}

beforeEach(() => {
  sendSupportMessage.mockReset()
})

describe('«Bizimlə əlaqə» with DATA_SOURCE=api', () => {
  it('gives the ticket without the demo note, and keeps the form after a network failure', async () => {
    const user = userEvent.setup()
    sendSupportMessage.mockRejectedValueOnce(new TypeError('fetch failed'))
    render(<ContactForm initialTopic="account" />, { wrapper: wrap('api') })
    await user.type(screen.getByLabelText('Adınız'), 'Aynur')
    await user.click(screen.getByRole('radio', { name: 'E-poçt' }))
    await user.type(screen.getByLabelText('E-poçt ünvanı'), 'aynur@poct.az')
    await user.type(screen.getByLabelText(/Mesaj/), 'Şifrəmi unutmuşam, kömək edin')
    await user.click(screen.getByRole('button', { name: 'Mesajı göndər' }))
    expect(await screen.findByText(/İnternet bağlantısını yoxlayın/)).toBeInTheDocument()
    sendSupportMessage.mockResolvedValueOnce({ ok: true, ticket: 1001 })
    await user.click(screen.getByRole('button', { name: 'Mesajı göndər' }))
    expect(await screen.findByText('Müraciət № 1001 qəbul olundu')).toBeInTheDocument()
    expect(screen.queryByText(/Demo:/)).not.toBeInTheDocument()
  })
})
