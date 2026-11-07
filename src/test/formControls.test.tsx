import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OtpField, PasswordField, PhoneField, Switch } from '@/components/ui/FormControls'
import { TextField } from '@/components/ui/Field'
import { formatLocal, isCompletePhone, localDigits, phoneFieldError, phoneValue } from '@/lib/phone'

describe('phone helpers', () => {
  it.each([
    ['+994505551234', '505551234'],
    ['+994 50 555 12 34', '505551234'],
    ['0505551234', '505551234'],
    ['(050) 555-12-34', '505551234'],
    ['5055', '5055'],
  ])('reads %s as %s', (input, digits) => {
    expect(localDigits(input)).toBe(digits)
  })

  it('groups the local part as it is typed', () => {
    expect(formatLocal('5')).toBe('5')
    expect(formatLocal('50555')).toBe('50 555')
    expect(formatLocal('505551234')).toBe('50 555 12 34')
    expect(phoneValue('0505551234')).toBe('+994 50 555 12 34')
    expect(phoneValue('')).toBe('')
  })

  it('says what is wrong with a number', () => {
    expect(phoneFieldError('')).toBe('Telefon nömrəsini yazın.')
    expect(phoneFieldError('', { required: false })).toBeUndefined()
    expect(phoneFieldError('+994 50 555')).toMatch(/9 rəqəm/)
    expect(phoneFieldError('+994 33 555 12 34')).toMatch(/Operator kodu/)
    expect(phoneFieldError('+994 50 555 12 34')).toBeUndefined()
    expect(isCompletePhone('+994 50 555 12 34')).toBe(true)
  })
})

function PhoneHarness() {
  const [value, setValue] = useState('')
  return (
    <>
      <PhoneField value={value} onValueChange={setValue} hint="SMS kodu bu nömrəyə gələcək." />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('PhoneField', () => {
  it('formats typed digits and keeps +994 in the value', async () => {
    const user = userEvent.setup()
    render(<PhoneHarness />)
    const input = screen.getByRole('textbox', { name: /Telefon nömrəsi/ })
    expect(input).toHaveAttribute('type', 'tel')
    expect(input).toHaveAttribute('autocomplete', 'tel')
    expect(input).toHaveAccessibleDescription('SMS kodu bu nömrəyə gələcək.')
    await user.type(input, '505551234')
    expect(input).toHaveValue('50 555 12 34')
    expect(screen.getByTestId('value')).toHaveTextContent('+994 50 555 12 34')
  })
})

describe('PasswordField', () => {
  it('shows and hides the password with a pressed button', async () => {
    const user = userEvent.setup()
    render(<PasswordField value="gizli1234" onValueChange={() => {}} autoComplete="current-password" />)
    const input = screen.getByLabelText('Şifrə')
    expect(input).toHaveAttribute('type', 'password')
    const toggle = screen.getByRole('button', { name: 'Şifrəni göstər' })
    await user.click(toggle)
    expect(input).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('OtpField', () => {
  it('is one numeric input that browsers can fill from the SMS', async () => {
    const user = userEvent.setup()
    let value = ''
    const { rerender } = render(<OtpField value={value} onValueChange={(v) => (value = v)} />)
    const input = screen.getByLabelText('SMS kodu')
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    await user.type(input, '12a')
    rerender(<OtpField value={value} onValueChange={(v) => (value = v)} />)
    expect(value).toMatch(/^\d*$/)
  })
})

describe('Switch and TextField', () => {
  it('toggles with aria-checked', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [on, setOn] = useState(false)
      return <Switch checked={on} onCheckedChange={setOn} label="WhatsApp-a yazmaq olar" description="Alıcılar sizə WhatsApp-da yaza bilər." />
    }
    render(<Harness />)
    const toggle = screen.getByRole('switch', { name: 'WhatsApp-a yazmaq olar' })
    expect(toggle).toHaveAccessibleDescription('Alıcılar sizə WhatsApp-da yaza bilər.')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('describes a field by its error while there is one, and marks optional fields', () => {
    render(<TextField label="Ərazi" optional hint="Kənd, qəsəbə və ya küçə" error="Çox uzundur." />)
    const input = screen.getByRole('textbox', { name: /Ərazi/ })
    expect(input).toHaveAccessibleDescription('Çox uzundur.')
    expect(screen.getByText('(istəyə bağlı)')).toBeInTheDocument()
  })
})
