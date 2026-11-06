import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Aç
      </button>
      <Dialog open={open} title="Filtrlər" onClose={() => setOpen(false)}>
        <p>Məzmun</p>
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.removeAttribute('style')
  })

  it('locks the page and pads it by the scrollbar width, then restores both and the focus', async () => {
    // A classic 15 px scrollbar: the viewport is 15 px narrower than the window.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1009)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Aç' })
    await user.click(opener)

    expect(screen.getByRole('dialog', { name: 'Filtrlər' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.paddingRight).toBe('15px')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.paddingRight).toBe('')
    expect(opener).toHaveFocus()
  })

  it('adds no padding when the scrollbar takes no room (overlay scrollbars, phones)', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(390)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Aç' }))
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.paddingRight).toBe('')
  })

  it('gives the close button a 44 px target', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Aç' }))
    expect(screen.getByRole('button', { name: 'Bağla' })).toHaveClass('size-11')
  })
})
