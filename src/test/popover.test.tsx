import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isPanelOpen, Popover } from '@/components/ui/Popover'

function PriceChip() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Popover open={open} onOpenChange={setOpen} label="Qiymət, ₼" trigger={(props) => <button {...props}>Qiymət</button>}>
        {(close) => (
          <>
            <input aria-label="Minimum qiymət" />
            <button type="button" onClick={close}>
              50 ₼-a qədər
            </button>
          </>
        )}
      </Popover>
      <button type="button">Hündürlük</button>
    </>
  )
}

const chip = () => screen.getByRole('button', { name: 'Qiymət' })

describe('Popover', () => {
  it('opens a named dialog under its trigger and moves focus into it', async () => {
    const user = userEvent.setup()
    render(<PriceChip />)
    expect(chip()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
    expect(chip()).not.toHaveAttribute('aria-controls')

    await user.click(chip())
    const dialog = screen.getByRole('dialog', { name: 'Qiymət, ₼' })
    expect(chip()).toHaveAttribute('aria-expanded', 'true')
    expect(chip()).toHaveAttribute('aria-controls', dialog.id)
    expect(screen.getByRole('textbox', { name: 'Minimum qiymət' })).toHaveFocus()
    expect(isPanelOpen()).toBe(true)
  })

  it('closes on Esc and returns focus to the chip', async () => {
    const user = userEvent.setup()
    render(<PriceChip />)
    await user.click(chip())
    await user.keyboard('{Escape}')
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
    expect(chip()).toHaveFocus()
    expect(isPanelOpen()).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('returns focus to the chip when an option closes it', async () => {
    const user = userEvent.setup()
    render(<PriceChip />)
    await user.click(chip())
    await user.click(screen.getByRole('button', { name: '50 ₼-a qədər' }))
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
    expect(chip()).toHaveFocus()
  })

  it('closes on a press outside without pulling focus back', async () => {
    const user = userEvent.setup()
    render(<PriceChip />)
    await user.click(chip())
    await user.click(screen.getByRole('button', { name: 'Hündürlük' }))
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Hündürlük' })).toHaveFocus()
  })

  it('closes when Tab leaves the panel', async () => {
    const user = userEvent.setup()
    render(<PriceChip />)
    await user.click(chip())
    await user.tab() // input → option button
    expect(chip()).toHaveAttribute('aria-expanded', 'true')
    await user.tab() // option button → outside
    expect(chip()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Hündürlük' })).toHaveFocus()
  })
})
