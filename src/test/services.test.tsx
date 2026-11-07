import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { serviceHref } from '@/features/services/query'
import { RequestButton } from '@/features/services/RequestDialog'
import { AppStoreProvider } from '@/state/store'

const sendServiceRequest = vi.fn(async (input: unknown) => (void input, { ok: true as const, id: 'req-3021', number: 3021 }))
vi.mock('@/features/services/actions', () => ({ sendServiceRequest: (input: unknown) => sendServiceRequest(input) }))

describe('services catalogue links', () => {
  it('changes one filter and resets the page', () => {
    expect(serviceHref('kateqoriya=cim-salinmasi&sehife=2', { nov: 'sirketler' })).toBe('/xidmetler?kateqoriya=cim-salinmasi&nov=sirketler')
    expect(serviceHref('kateqoriya=cim-salinmasi', { kateqoriya: undefined })).toBe('/xidmetler')
    expect(serviceHref('seher=baki&q=cim', { sehife: '2' })).toBe('/xidmetler?q=cim&sehife=2')
  })
})

describe('«Usta çağır»', () => {
  it('asks for the essentials, then sends the request to the provider and shows its number', async () => {
    const user = userEvent.setup()
    render(
      <AppStoreProvider>
        <RequestButton provider={{ id: 'yasil-mekan-landsaft', name: 'Yaşıl Məkan Landşaft' }} serviceId="landsaft-dizayni" categoryId="landsaft-dizayni" />
      </AppStoreProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Usta çağır' }))
    const dialog = screen.getByRole('dialog', { name: 'Usta çağır: Yaşıl Məkan Landşaft' })
    expect(within(dialog).getByLabelText('Xidmət')).toHaveValue('landsaft-dizayni')
    await user.click(within(dialog).getByRole('button', { name: 'Sorğunu göndər' }))
    expect(within(dialog).getByText('Şəhəri seçin.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Şəhər')).toHaveFocus()
    expect(sendServiceRequest).not.toHaveBeenCalled()

    await user.selectOptions(within(dialog).getByLabelText('Şəhər'), 'baki')
    await user.type(within(dialog).getByLabelText('Nə etmək lazımdır'), 'Həyətə çim salmaq, 120 m²')
    await user.type(within(dialog).getByLabelText('Adınız'), 'Leyla')
    await user.type(within(dialog).getByRole('textbox', { name: /Telefon nömrəsi/ }), '557001122')
    await user.click(within(dialog).getByRole('button', { name: 'Sorğunu göndər' }))
    expect(sendServiceRequest).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'yasil-mekan-landsaft', serviceId: 'landsaft-dizayni', categoryId: 'landsaft-dizayni', cityId: 'baki', name: 'Leyla', phone: '+994 55 700 11 22' }),
    )
    expect(await within(dialog).findByText('Sorğu № 3021 göndərildi')).toBeInTheDocument()
  })
})
