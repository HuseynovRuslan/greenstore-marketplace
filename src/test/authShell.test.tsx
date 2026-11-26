import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AccountTypeCard, AuthShell, AuthSteps } from '@/features/auth/ui'

describe('AuthShell', () => {
  it('switches between sign-in and registration by links that keep where to go next', () => {
    render(
      <AuthShell tab="login" next="/elan-yerlesdir" title="Hesabınıza daxil olun">
        <p>Forma</p>
      </AuthShell>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Hesabınıza daxil olun' })).toBeInTheDocument()
    const nav = within(screen.getByRole('navigation', { name: 'Giriş və qeydiyyat' }))
    expect(nav.getByRole('link', { name: 'Daxil ol' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: 'Hesab yarat' })).toHaveAttribute('href', '/qeydiyyat?next=%2Felan-yerlesdir')
  })

  it('shows the photo panel from 1024 px only, so a phone downloads no photo', () => {
    const { container } = render(<AuthShell title="Şifrəni bərpa edin">x</AuthShell>)
    // No tabs on the password reset page.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    const aside = container.querySelector('aside')
    expect(aside).toHaveAttribute('aria-hidden', 'true')
    expect(aside?.querySelector('source')).toHaveAttribute('media', '(min-width: 64rem)')
    expect(aside?.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/gif;base64,/)
    expect(aside).toHaveTextContent('GreenStore-a xoş gəlmisiniz!')
  })
})

describe('AuthSteps', () => {
  it('marks the steps done, current and to come', () => {
    render(<AuthSteps steps={['Hesab növü', 'Məlumatlar', 'Telefonun təsdiqi']} current={1} />)
    const steps = screen.getAllByRole('listitem')
    expect(steps[0]).toHaveTextContent('Hesab növü, tamamlanıb')
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[1]).toHaveTextContent('Məlumatlar, indiki addım')
    expect(steps[2]).not.toHaveAttribute('aria-current')
  })
})

describe('AccountTypeCard', () => {
  it('is a radio named by its title and description', () => {
    render(<AccountTypeCard name="type" value="business" checked onChange={() => {}} icon={null} title="Biznes" description="Tingçilik, bağ mərkəzi" />)
    expect(screen.getByRole('radio', { name: /Biznes/ })).toBeChecked()
  })
})
