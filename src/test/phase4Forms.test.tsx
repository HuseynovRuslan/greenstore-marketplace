import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { ContactForm } from '@/features/support/ContactForm'
import { RequestButton } from '@/features/services/RequestDialog'
import { AppStoreProvider } from '@/state/store'

/*
 * «Usta çağır» and «Bizimlə əlaqə» in the browser (backend-contract.md 4.2): the demo's «Demo: … göndərilmir» note only
 * with DATA_SOURCE=mock, and the request's Idempotency-Key: the same request sent again (a lost answer) keeps its key,
 * a changed one gets a new one. The Server Actions are fakes.
 */

vi.setConfig({ testTimeout: 20_000 })

const { sendServiceRequest, sendSupportMessage } = vi.hoisted(() => ({ sendServiceRequest: vi.fn(), sendSupportMessage: vi.fn() }))
vi.mock('@/features/services/actions', () => ({ sendServiceRequest }))
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
  sendServiceRequest.mockReset()
  sendSupportMessage.mockReset()
})

async function fillRequest(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Usta çağır' }))
  const dialog = screen.getByRole('dialog', { name: 'Usta çağır' })
  await user.selectOptions(within(dialog).getByLabelText('Xidmət'), 'bag-baximi')
  await user.selectOptions(within(dialog).getByLabelText('Şəhər'), 'baki')
  await user.type(within(dialog).getByLabelText('Nə etmək lazımdır'), 'Bağa həftəlik baxım lazımdır')
  await user.type(within(dialog).getByLabelText('Adınız'), 'Leyla')
  await user.type(within(dialog).getByRole('textbox', { name: /Telefon nömrəsi/ }), '557001122')
  return dialog
}

describe('«Usta çağır» with DATA_SOURCE=api', () => {
  it('keeps the key for the same request and makes a new one for a changed request; no demo note', async () => {
    const user = userEvent.setup()
    sendServiceRequest.mockResolvedValueOnce({ ok: false, error: 'Sorğunu göndərmək alınmadı. Bir az sonra yenidən cəhd edin.' })
    render(<RequestButton />, { wrapper: wrap('api') })
    const dialog = await fillRequest(user)
    await user.click(within(dialog).getByRole('button', { name: 'Sorğunu göndər' }))
    expect(await within(dialog).findByText(/Bir az sonra yenidən cəhd edin/)).toBeInTheDocument()
    const first = sendServiceRequest.mock.calls[0][1] as string
    expect(first).toMatch(/^sorgu-[0-9a-f-]{36}$/)

    sendServiceRequest.mockResolvedValueOnce({ ok: false, error: 'Yenə alınmadı.' })
    await user.click(within(dialog).getByRole('button', { name: 'Sorğunu göndər' }))
    expect(sendServiceRequest.mock.calls[1][1]).toBe(first)

    sendServiceRequest.mockResolvedValueOnce({ ok: true, id: 'q1', number: 3001 })
    await user.type(within(dialog).getByLabelText(/Ərazi/), 'Mərdəkan')
    await user.click(within(dialog).getByRole('button', { name: 'Sorğunu göndər' }))
    expect(sendServiceRequest.mock.calls[2][1]).not.toBe(first)
    expect(await within(dialog).findByText('Sorğu № 3001 göndərildi')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Demo:/)).not.toBeInTheDocument()
  })

  it('says it is a demo with DATA_SOURCE=mock', async () => {
    const user = userEvent.setup()
    sendServiceRequest.mockResolvedValueOnce({ ok: true, id: 'req-3021', number: 3021 })
    render(<RequestButton />, { wrapper: wrap('mock') })
    const dialog = await fillRequest(user)
    await user.click(within(dialog).getByRole('button', { name: 'Sorğunu göndər' }))
    expect(await within(dialog).findByText(/Demo: sorğu heç kimə göndərilmir\./)).toBeInTheDocument()
  })
})

describe('«Bizimlə əlaqə» with DATA_SOURCE=api', () => {
  it('gives the ticket without the demo note, and keeps the form after a network failure', async () => {
    const user = userEvent.setup()
    sendSupportMessage.mockRejectedValueOnce(new TypeError('fetch failed'))
    render(<ContactForm initialTopic="account" />, { wrapper: wrap('api') })
    await user.type(screen.getByLabelText('Adınız'), 'Aynur')
    await user.type(screen.getByLabelText('Telefon və ya e-poçt'), 'aynur@poct.az')
    await user.type(screen.getByLabelText(/Mesaj/), 'Şifrəmi unutmuşam, kömək edin')
    await user.click(screen.getByRole('button', { name: 'Mesajı göndər' }))
    expect(await screen.findByText(/İnternet bağlantısını yoxlayın/)).toBeInTheDocument()
    sendSupportMessage.mockResolvedValueOnce({ ok: true, ticket: 1001 })
    await user.click(screen.getByRole('button', { name: 'Mesajı göndər' }))
    expect(await screen.findByText('Müraciət № 1001 qəbul olundu')).toBeInTheDocument()
    expect(screen.queryByText(/Demo:/)).not.toBeInTheDocument()
  })
})
