import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { ToastProvider } from '@/components/ui/Toast'
import type { AccountProfile } from '@/data/user'
import { listingById } from '@/data/listings'
import { ProfileForm } from '@/features/account/profile/ProfileForm'
import { SecurityForm } from '@/features/account/profile/SecurityForm'
import { resetRemoteSavedSearches } from '@/features/saved-searches/useSavedSearches'
import { encodeSessionHint, GUEST_FAVORITES_KEY, SESSION_HINT_COOKIE } from '@/state/bootstrap'
import { AppStoreProvider, useFavorites, useSession } from '@/state/store'
import FavoritesPage from '@/views/account/FavoritesPage'
import SavedSearchesPage from '@/views/account/SavedSearchesPage'
import LoginPage from '@/views/LoginPage'

/*
 * DATA_SOURCE=api in the browser (backend-contract.md 2.1–2.3): the store asks the server who is signed in, the
 * account's favourites and saved searches go through Server Actions, the forms save to the API. The actions are fakes
 * here (accountActions.test.ts tests them); DATA_SOURCE=mock is what the other tests render.
 */

vi.setConfig({ testTimeout: 20_000 })

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/kabinet',
  useSearchParams: () => new URLSearchParams(),
}))

const account = vi.hoisted(() => ({
  loadSession: vi.fn(),
  setFavorite: vi.fn(),
  mergeFavorites: vi.fn(),
  signOut: vi.fn(),
  saveProfile: vi.fn(),
  changePassword: vi.fn(),
  confirmPhoneChange: vi.fn(),
  loadFavoriteItems: vi.fn(),
}))
vi.mock('@/features/account/actions', () => account)

const auth = vi.hoisted(() => ({
  requestCode: vi.fn(),
  verifyCode: vi.fn(),
  registerAccount: vi.fn(),
  resetPasswordWithCode: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithCode: vi.fn(),
}))
vi.mock('@/features/auth/actions', () => auth)

const searches = vi.hoisted(() => ({
  listSavedSearches: vi.fn(),
  saveSearch: vi.fn(),
  updateSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  openSavedSearch: vi.fn(),
}))
vi.mock('@/features/saved-searches/actions', () => searches)

const business: AccountProfile = {
  id: '0193-u',
  fullName: 'Nigar Rzayeva',
  email: 'nigar@bag.az',
  phone: '+994 55 512 34 56',
  accountType: 'business',
  sellerId: '0193-s',
  role: 'user',
  locale: 'az',
  phoneVerified: true,
  companyName: 'Yaşıl Həyət',
  businessKinds: ['garden-centre'],
  cityId: 'baki',
  sellerSlug: 'yasil-heyet',
  sellerImage: '',
  sellerVersion: '812',
}
const individual: AccountProfile = { id: '0193-i', fullName: 'Rəşad Quliyev', email: '', phone: '+994 50 940 49 11', accountType: 'individual', role: 'user', locale: 'az', phoneVerified: true }

const setHint = () => (document.cookie = `${SESSION_HINT_COOKIE}=${encodeURIComponent(encodeSessionHint({ initials: 'NR', issuedAt: 1 }))}; path=/`)
const inApi = (ui: ReactNode) =>
  render(
    <AppStoreProvider dataSource="api">
      <ToastProvider>{ui}</ToastProvider>
    </AppStoreProvider>,
  )

/** The store as a component sees it. */
function Probe() {
  const { user, status, signIn, signOut } = useSession()
  const { favorites, toggleFavorite } = useFavorites()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.fullName ?? 'guest'}</p>
      <p data-testid="favorites">{favorites.join(',')}</p>
      <button onClick={() => toggleFavorite('listing', '0193-b')}>toggle</button>
      <button onClick={() => signIn(business)}>sign in</button>
      <button onClick={() => void signOut()}>sign out</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  replace.mockClear()
  resetRemoteSavedSearches()
  for (const fn of [...Object.values(account), ...Object.values(auth), ...Object.values(searches)]) fn.mockReset()
  account.loadSession.mockResolvedValue({ account: business, favorites: ['listing:0193-a'] })
  account.setFavorite.mockResolvedValue({ ok: true })
  account.mergeFavorites.mockImplementation(async (keys: string[]) => ({ ok: true, favorites: ['listing:0193-a', ...keys] }))
  account.signOut.mockResolvedValue(undefined)
  searches.listSavedSearches.mockResolvedValue([])
})

afterEach(() => {
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`
})

describe('the store with DATA_SOURCE=api', () => {
  it('a guest (no hint cookie) is known at once, without asking the server', async () => {
    inApi(<Probe />)
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
    expect(screen.getByTestId('user')).toHaveTextContent('guest')
    expect(account.loadSession).not.toHaveBeenCalled()
  })

  it('asks the server who is signed in when the hint says someone is, then saves hearts on the account', async () => {
    setHint()
    inApi(<Probe />)
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Nigar Rzayeva'))
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
    expect(screen.getByTestId('favorites')).toHaveTextContent('listing:0193-a')

    await userEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('favorites')).toHaveTextContent('listing:0193-a,listing:0193-b')
    expect(account.setFavorite).toHaveBeenCalledWith('listing', '0193-b', true)
    // Nothing goes to the guest list in this browser.
    expect(localStorage.getItem(GUEST_FAVORITES_KEY)).toBeNull()
  })

  it('keeps a signed-in visitor signed in while the API cannot be asked, and asks again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setHint()
      account.loadSession.mockResolvedValueOnce({ account: null, favorites: [], unavailable: true }).mockRejectedValueOnce(new Error('offline'))
      inApi(<Probe />)
      await waitFor(() => expect(account.loadSession).toHaveBeenCalledTimes(1))
      await act(() => vi.advanceTimersByTimeAsync(100))
      // Not a guest: the hint stays and the pages keep their signed-in placeholders.
      expect(screen.getByTestId('status')).toHaveTextContent('loading')
      await act(() => vi.advanceTimersByTimeAsync(3_000))
      expect(account.loadSession).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('status')).toHaveTextContent('loading')
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Nigar Rzayeva'))
      expect(account.loadSession).toHaveBeenCalledTimes(3)
      expect(screen.getByTestId('status')).toHaveTextContent('ready')
    } finally {
      vi.useRealTimers()
    }
  })

  it('takes a heart back when the server did not save it, and a guest when the session ended', async () => {
    setHint()
    account.setFavorite.mockResolvedValue({ ok: false, signedOut: true })
    inApi(<Probe />)
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('Nigar Rzayeva'))
    await userEvent.click(screen.getByRole('button', { name: 'toggle' }))
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('guest'))
  })

  it("on sign-in the guest's hearts join the account and leave this browser; sign-out ends the session", async () => {
    localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(['listing:0193-g']))
    inApi(<Probe />)
    expect(screen.getByTestId('favorites')).toHaveTextContent('listing:0193-g')
    await userEvent.click(screen.getByRole('button', { name: 'sign in' }))
    expect(screen.getByTestId('user')).toHaveTextContent('Nigar Rzayeva')
    expect(account.mergeFavorites).toHaveBeenCalledWith(['listing:0193-g'])
    await waitFor(() => expect(screen.getByTestId('favorites')).toHaveTextContent('listing:0193-a,listing:0193-g'))
    expect(JSON.parse(localStorage.getItem(GUEST_FAVORITES_KEY)!)).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }))
    expect(screen.getByTestId('user')).toHaveTextContent('guest')
    expect(account.signOut).toHaveBeenCalled()
  })
})

describe('pages with DATA_SOURCE=api', () => {
  it('shows no demo banner: the listings and accounts are real (Nov 2026)', () => {
    inApi(<DemoBanner />)
    expect(screen.queryByRole('complementary', { name: 'Demo versiya' })).not.toBeInTheDocument()
    expect(screen.queryByText(/nümunə/)).not.toBeInTheDocument()
  })

  it('signs in with the password through the API and says why it was refused', async () => {
    const user = userEvent.setup()
    auth.signInWithPassword.mockResolvedValueOnce({ ok: false, error: 'Telefon, e-poçt və ya şifrə səhvdir.' }).mockResolvedValueOnce({ ok: true, account: individual })
    inApi(<LoginPage next="/kabinet/profil" />)
    // The demo's hint (any login works) is not shown with a real API.
    expect(screen.queryByText(/istənilən düzgün nömrə/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Telefon və ya e-poçt'), '050 940 49 11')
    await user.type(screen.getByLabelText('Şifrə'), 'yanlis2026')
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    expect(await screen.findByText('Telefon, e-poçt və ya şifrə səhvdir.')).toBeInTheDocument()
    expect(auth.signInWithPassword).toHaveBeenCalledWith('+994 50 940 49 11', 'yanlis2026', true)
    expect(screen.getByLabelText('Şifrə')).toHaveValue('')

    await user.type(screen.getByLabelText('Şifrə'), 'bagca2026')
    await user.click(screen.getByRole('button', { name: 'Daxil ol' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/kabinet/profil'))
    // Signed in through the cookie: nothing is written to the demo's localStorage session.
    expect(localStorage.getItem('greenstore:session')).toBeNull()
  })

  it('signs in with an SMS code through the API', async () => {
    const user = userEvent.setup()
    auth.requestCode.mockResolvedValue({ ok: true, challengeId: 'c-1', phoneMasked: '+994 50 *** ** 11', expiresInSec: 300, resendInSec: 60, demoCode: '4821' })
    auth.verifyCode.mockResolvedValue({ ok: true })
    auth.signInWithCode.mockResolvedValue({ ok: true, account: individual })
    inApi(<LoginPage />)
    await user.click(screen.getByRole('button', { name: 'SMS kodu ilə daxil olun' }))
    await user.type(screen.getByRole('textbox', { name: /Telefon nömrəsi/ }), '509404911')
    await user.click(screen.getByRole('button', { name: 'Kod göndər' }))
    await user.type(await screen.findByRole('textbox', { name: 'SMS kodu' }), '4821')
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/kabinet'))
    expect(auth.signInWithCode).toHaveBeenCalledWith('c-1', true)
  })

  it('does not call a code expired when the server could not check it', async () => {
    const user = userEvent.setup()
    auth.requestCode.mockResolvedValue({ ok: true, challengeId: 'c-1', phoneMasked: '+994 50 *** ** 11', expiresInSec: 300, resendInSec: 60 })
    auth.verifyCode.mockResolvedValue({ ok: false, message: 'Server indi cavab vermir. Bir az sonra yenidən cəhd edin.' })
    inApi(<LoginPage />)
    await user.click(screen.getByRole('button', { name: 'SMS kodu ilə daxil olun' }))
    await user.type(screen.getByRole('textbox', { name: /Telefon nömrəsi/ }), '509404911')
    await user.click(screen.getByRole('button', { name: 'Kod göndər' }))
    await user.type(await screen.findByRole('textbox', { name: 'SMS kodu' }), '4821')
    expect(await screen.findByText('Server indi cavab vermir. Bir az sonra yenidən cəhd edin.')).toBeInTheDocument()
    expect(screen.queryByText(/Kodun vaxtı bitib/)).not.toBeInTheDocument()
    expect(auth.signInWithCode).not.toHaveBeenCalled()
  })

  it('a business keeps at least one kind: with none ticked nothing is saved', async () => {
    const user = userEvent.setup()
    inApi(<ProfileForm account={business} onSave={vi.fn()} />)
    const kinds = screen.getByRole('group', { name: 'Biznesin növü' })
    expect(within(kinds).getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([false, true, false])
    await user.click(within(kinds).getByRole('checkbox', { name: /Bağ mərkəzi/ }))
    await user.click(screen.getByRole('button', { name: 'Dəyişiklikləri yadda saxla' }))
    expect(await within(kinds).findByText('Ən azı bir biznes növü seçin.')).toBeInTheDocument()
    expect(account.saveProfile).not.toHaveBeenCalled()
  })

  it('a business saves its shop details to the API', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    account.saveProfile.mockResolvedValueOnce({ ok: true, account: { ...business, companyName: 'Yaşıl Həyət Bağ' } })
    inApi(<ProfileForm account={business} onSave={onSave} />)
    await user.clear(screen.getByLabelText('Şirkətin adı'))
    await user.type(screen.getByLabelText('Şirkətin adı'), 'Y')
    await user.click(screen.getByRole('button', { name: 'Dəyişiklikləri yadda saxla' }))
    // The API's rule (2–80 characters) is said before anything is sent.
    expect(await screen.findByText('Şirkətin adı ən azı 2 simvol olsun.')).toBeInTheDocument()
    expect(account.saveProfile).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Şirkətin adı'), 'aşıl Həyət Bağ')
    await user.selectOptions(screen.getByLabelText('Şəhər'), 'quba')
    await user.type(screen.getByLabelText('Şirkət haqqında'), 'Qubada tingçilik')
    // A garden centre that grows its own trees too: both kinds.
    await user.click(screen.getByRole('checkbox', { name: /Tingçilik təsərrüfatı/ }))
    await user.click(screen.getByRole('button', { name: 'Dəyişiklikləri yadda saxla' }))
    expect(await screen.findByText('Dəyişikliklər saxlanıldı')).toBeInTheDocument()
    // With the «mağaza»'s version the form was loaded with: a change from another tab is not overwritten.
    expect(account.saveProfile).toHaveBeenLastCalledWith({ fullName: 'Nigar Rzayeva', email: 'nigar@bag.az', companyName: 'Yaşıl Həyət Bağ', businessKinds: ['nursery', 'garden-centre'], cityId: 'quba', address: '', about: 'Qubada tingçilik', sellerVersion: '812' })
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ companyName: 'Yaşıl Həyət Bağ' }))
    // The number did not change: no SMS code.
    expect(auth.requestCode).not.toHaveBeenCalled()
  })

  it('says so when the name and e-mail were saved but the shop was not', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    account.saveProfile.mockResolvedValue({ ok: false, error: 'Profil başqa cihazda dəyişdirilib. Səhifəni yeniləyin və yenidən yoxlayın.', saved: { fullName: 'Nigar R.', email: 'nigar@bag.az' } })
    inApi(<ProfileForm account={business} onSave={onSave} />)
    const contact = within(screen.getByRole('group', { name: 'Əlaqə şəxsi' }))
    await user.clear(contact.getByLabelText('Ad'))
    await user.type(contact.getByLabelText('Ad'), 'Nigar')
    await user.clear(contact.getByLabelText('Soyad'))
    await user.type(contact.getByLabelText('Soyad'), 'R.')
    await user.click(screen.getByRole('button', { name: 'Dəyişiklikləri yadda saxla' }))
    expect(await screen.findByText('Mağaza məlumatları saxlanılmadı')).toBeInTheDocument()
    expect(screen.getByText('Ad və e-poçt saxlanıldı. Profil başqa cihazda dəyişdirilib. Səhifəni yeniləyin və yenidən yoxlayın.')).toBeInTheDocument()
    expect(screen.queryByText('Dəyişikliklər saxlanıldı')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledWith({ fullName: 'Nigar R.', email: 'nigar@bag.az' })
  })

  it('a new number is confirmed by an SMS code to it', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    account.saveProfile.mockResolvedValue({ ok: true, account: individual })
    auth.requestCode.mockResolvedValue({ ok: true, challengeId: 'c-9', phoneMasked: '+994 70 *** ** 21', expiresInSec: 300, resendInSec: 60 })
    auth.verifyCode.mockResolvedValue({ ok: true })
    account.confirmPhoneChange.mockResolvedValue({ ok: true, phone: '+994 70 765 43 21' })
    inApi(<ProfileForm account={individual} onSave={onSave} />)
    // An individual account has no city or address on the API.
    expect(screen.queryByLabelText('Şəhər')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ünvan')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Telefon nömrəsi'))
    await user.type(screen.getByLabelText('Telefon nömrəsi'), '+994707654321')
    await user.click(screen.getByRole('button', { name: 'Dəyişiklikləri yadda saxla' }))
    expect(auth.requestCode).toHaveBeenCalledWith('+994 70 765 43 21', 'change-phone')
    expect(await screen.findByText(/Yeni nömrəni SMS kodu ilə təsdiqləyin/)).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'SMS kodu' }), '1234')
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ phone: '+994 70 765 43 21', phoneVerified: true }))
    expect(account.confirmPhoneChange).toHaveBeenCalledWith('c-9')
  })

  it('changes the password through the API', async () => {
    const user = userEvent.setup()
    account.changePassword.mockResolvedValueOnce({ ok: false, field: 'current', error: 'Cari şifrə düzgün deyil.' }).mockResolvedValueOnce({ ok: true })
    inApi(<SecurityForm />)
    await user.type(screen.getByLabelText('Cari şifrə'), 'yanlis')
    await user.type(screen.getByLabelText('Yeni şifrə'), 'yeniSifre2027')
    await user.click(screen.getByRole('button', { name: 'Şifrəni dəyiş' }))
    expect(await screen.findByText('Cari şifrə düzgün deyil.')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Cari şifrə'))
    await user.type(screen.getByLabelText('Cari şifrə'), 'bagca2026')
    await user.click(screen.getByRole('button', { name: 'Şifrəni dəyiş' }))
    expect(await screen.findByText('Şifrə dəyişdirildi')).toBeInTheDocument()
    expect(account.changePassword).toHaveBeenLastCalledWith('bagca2026', 'yeniSifre2027')
  })

  it('«Axtarışlarım» shows the account’s searches from the API and deletes there', async () => {
    const user = userEvent.setup()
    setHint()
    searches.listSavedSearches.mockResolvedValue([{ id: '0193-q', name: 'Bakıda ağaclar', query: 'kateqoriya=agaclar&seher=baki', alerts: true, createdAt: '2026-11-20T10:00:00Z', newCount: 2 }])
    searches.deleteSavedSearch.mockResolvedValue(true)
    searches.updateSavedSearch.mockImplementation(async (id: string, patch: object) => ({ id, ...patch }))
    inApi(<SavedSearchesPage />)
    const link = await screen.findByRole('link', { name: 'Bakıda ağaclar' })
    const card = link.closest('li')!
    expect(within(card).getByText('2 yeni')).toBeInTheDocument()
    await user.click(within(card).getByRole('switch'))
    expect(searches.updateSavedSearch).toHaveBeenCalledWith('0193-q', { alerts: false })
    await user.click(within(card).getByRole('button', { name: 'Sil' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Axtarışı silək?' })).getByRole('button', { name: 'Axtarışı sil' }))
    expect(searches.deleteSavedSearch).toHaveBeenCalledWith('0193-q')
    expect(screen.queryByRole('link', { name: 'Bakıda ağaclar' })).not.toBeInTheDocument()
  })

  it('«Seçilmişlər» shows the account’s cards from the API; a guest is asked to sign in to see theirs', async () => {
    setHint()
    const zeytun = listingById('zeytun-agaci')!
    account.loadSession.mockResolvedValue({ account: business, favorites: [`listing:${zeytun.id}`, 'listing:0193-gone'] })
    account.loadFavoriteItems.mockResolvedValue({ listings: [zeytun], services: [] })
    const { unmount } = inApi(<FavoritesPage />)
    expect(await screen.findByRole('link', { name: new RegExp(zeytun.title) })).toBeInTheDocument()
    // A key without a card (no longer for sale) shows nothing.
    expect(screen.getByRole('button', { name: /Məhsullar/ })).toHaveTextContent('1')
    unmount()

    document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`
    localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(['listing:0193-a', 'service:0193-b']))
    await act(async () => {
      inApi(<FavoritesPage />)
    })
    expect(screen.getByText('Seçilmişlərə baxmaq üçün daxil olun')).toBeInTheDocument()
    expect(screen.getByText(/Bəyəndiyiniz 2 elan/)).toBeInTheDocument()
    expect(account.loadFavoriteItems).toHaveBeenCalledTimes(1)
  })
})
