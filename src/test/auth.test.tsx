import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStoreProvider } from '@/state/store'
import LoginPage from '@/views/LoginPage'
import RegisterPage from '@/views/RegisterPage'

const replace = vi.fn()
// Long user-event flows: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20_000 })

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/daxil-ol',
  useSearchParams: () => new URLSearchParams(),
}))

const challenge = { challengeId: 'otp.505551234.1', phoneMasked: '+994 50 *** ** 34', expiresInSec: 300, resendInSec: 60, demoCode: '1234' }
const requestCode = vi.fn(async (phone: string, purpose: string) => (void phone, void purpose, { ok: true as const, ...challenge }))
const verifyCode = vi.fn(async (id: string, code: string) => (void id, code === '1234' ? { ok: true } : { ok: false, error: 'wrong-code' as const, attemptsLeft: 4 }))
const registerAccount = vi.fn(async (input: unknown) => (void input, { ok: true as const, userId: 'u-1' }))
vi.mock('@/features/auth/actions', () => ({
  requestCode: (phone: string, purpose: string) => requestCode(phone, purpose),
  verifyCode: (id: string, code: string) => verifyCode(id, code),
  registerAccount: (input: unknown) => registerAccount(input),
  resetPasswordWithCode: vi.fn(),
}))

const renderWithStore = (ui: React.ReactNode) => render(<AppStoreProvider>{ui}</AppStoreProvider>)

describe('login', () => {
  beforeEach(() => {
    localStorage.clear()
    replace.mockClear()
  })

  it('names what is missing, then signs in with a phone and password', async () => {
    const user = userEvent.setup()
    renderWithStore(<LoginPage next="/elan-yerlesdir/6" />)
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    expect(screen.getByText('Telefon nömrəsini və ya e-poçtu yazın.')).toBeInTheDocument()
    expect(screen.getByLabelText('Telefon və ya e-poçt')).toHaveFocus()
    expect(screen.getByLabelText('Telefon və ya e-poçt')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Şifrə')).toHaveAttribute('autocomplete', 'current-password')
    await user.type(screen.getByLabelText('Telefon və ya e-poçt'), '0505551234')
    await user.type(screen.getByLabelText('Şifrə'), 'greenstore')
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/elan-yerlesdir/6'))
    expect(JSON.parse(localStorage.getItem('greenstore:session') ?? '{}').phone).toBe('+994 50 555 12 34')
  })

  it('signs in with an SMS code after a wrong one', async () => {
    const user = userEvent.setup()
    renderWithStore(<LoginPage />)
    await user.click(screen.getByRole('radio', { name: 'SMS kodu ilə' }))
    await user.type(screen.getByRole('textbox', { name: /Telefon nömrəsi/ }), '505551234')
    await user.click(screen.getByRole('button', { name: 'Kod göndər' }))
    expect(requestCode).toHaveBeenCalledWith('+994 50 555 12 34', 'login')
    const code = await screen.findByRole('textbox', { name: 'SMS kodu' })
    expect(screen.getByText(/\+994 50 \*\*\* \*\* 34/)).toBeInTheDocument()
    await user.type(code, '0000')
    expect(await screen.findByText('Kod düzgün deyil. 4 cəhdiniz qalıb.')).toBeInTheDocument()
    await user.type(code, '1234')
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/kabinet'))
  })
})

describe('registration', () => {
  beforeEach(() => {
    localStorage.clear()
    replace.mockClear()
    registerAccount.mockClear()
  })

  it('asks the business kind and name, then details, then the code, and signs the new account in', async () => {
    const user = userEvent.setup()
    renderWithStore(<RegisterPage />)
    await user.click(screen.getByRole('button', { name: 'Davam et' }))
    expect(screen.getByText('Fərdi və ya biznes hesabı seçin.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Biznes/ }))
    await user.click(screen.getByRole('button', { name: 'Davam et' }))
    expect(screen.getByText('Biznesinizin növünü seçin.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Landşaft şirkəti/ }))
    await user.type(screen.getByLabelText('Biznesin adı'), 'Yaşıl Həyət')
    await user.click(screen.getByRole('button', { name: 'Davam et' }))

    await user.type(screen.getByLabelText('Əlaqələndirici şəxs'), 'Nigar Rzayeva')
    await user.type(screen.getByRole('textbox', { name: /Telefon nömrəsi/ }), '555123456')
    await user.type(screen.getByLabelText('Şifrə'), 'qisa')
    await user.click(screen.getByRole('button', { name: 'Kod göndər' }))
    expect(screen.getByText(/hərf və rəqəm olmalıdır/)).toBeInTheDocument()
    expect(screen.getByText('Davam etmək üçün şərtlərlə razılaşın.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Şifrə'), 'bag2026')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Kod göndər' }))

    await user.type(await screen.findByRole('textbox', { name: 'SMS kodu' }), '1234')
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/kabinet'))
    expect(registerAccount).toHaveBeenCalledWith(expect.objectContaining({ accountType: 'business', businessKind: 'landscaping', companyName: 'Yaşıl Həyət', otpChallengeId: challenge.challengeId }))
    const session = JSON.parse(localStorage.getItem('greenstore:session') ?? '{}')
    expect(session).toMatchObject({ fullName: 'Nigar Rzayeva', accountType: 'business', businessType: 'Landşaft şirkəti', phoneVerified: true })
    expect(session.sellerId).toBeUndefined()
  })
})
