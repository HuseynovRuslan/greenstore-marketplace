import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Listbox } from '@/components/ui/Listbox'
import { cities } from '@/data/cities'
import { formatNumber } from '@/lib/format'

// The counts are only text next to each option here (the home page gets them from the server).
const options = [
  { value: '', label: 'Bütün şəhərlər', meta: '4 040' },
  ...cities.map((c, i) => ({ value: c.id, label: c.name, meta: formatNumber((i + 1) * 120) })),
]
// Bütün şəhərlər · Bakı · Abşeron · Sumqayıt · Gəncə · Şəki · Quba · Lənkəran

function CityField({ onChange = () => {} }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <>
      <Listbox
        label="Şəhər"
        value={value}
        onChange={(v) => {
          setValue(v)
          onChange(v)
        }}
        options={options}
      />
      <button type="button">Axtar</button>
    </>
  )
}

const combobox = () => screen.getByRole('combobox', { name: 'Şəhər' })
const activeLabel = () => {
  const id = combobox().getAttribute('aria-activedescendant')
  return id ? document.getElementById(id)?.textContent?.replace(/[\d\s]+$/, '').trim() : undefined
}

let now = 1_000_000
beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})
afterEach(() => vi.restoreAllMocks())

describe('Listbox (select-only combobox)', () => {
  it('is a combobox named "Şəhər" that controls a hidden listbox', () => {
    render(<CityField />)
    expect(combobox()).toHaveAttribute('aria-haspopup', 'listbox')
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
    expect(combobox()).toHaveTextContent('Bütün şəhərlər')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(document.getElementById(combobox().getAttribute('aria-controls')!)).toHaveAttribute('role', 'listbox')
  })

  it.each([['{Enter}'], ['[Space]'], ['{ArrowDown}']])('opens with %s on the selected option', async (key) => {
    const user = userEvent.setup()
    render(<CityField />)
    combobox().focus()
    await user.keyboard(key)
    expect(combobox()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox', { name: 'Şəhər' })).toBeVisible()
    expect(screen.getAllByRole('option')).toHaveLength(8)
    expect(screen.getByRole('option', { name: /Bütün şəhərlər/ })).toHaveAttribute('aria-selected', 'true')
    expect(activeLabel()).toBe('Bütün şəhərlər')
    expect(combobox()).toHaveFocus()
  })

  it('moves the active option with the arrow keys, Home and End', async () => {
    const user = userEvent.setup()
    render(<CityField />)
    combobox().focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(activeLabel()).toBe('Abşeron')
    await user.keyboard('{End}')
    expect(activeLabel()).toBe('Lənkəran')
    await user.keyboard('{ArrowDown}')
    expect(activeLabel()).toBe('Lənkəran')
    await user.keyboard('{Home}{ArrowUp}')
    expect(activeLabel()).toBe('Bütün şəhərlər')
  })

  it('selects with Enter, closes and keeps focus on the trigger', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CityField onChange={onChange} />)
    combobox().focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('baki')
    expect(combobox()).toHaveTextContent('Bakı')
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
    expect(combobox()).not.toHaveAttribute('aria-activedescendant')
    expect(combobox()).toHaveFocus()
  })

  it('closes with Esc without changing the value and hides the list after the exit', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CityField onChange={onChange} />)
    combobox().focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    const list = screen.getByRole('listbox')
    await user.keyboard('{Escape}')
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
    expect(combobox()).toHaveTextContent('Bütün şəhərlər')
    expect(onChange).not.toHaveBeenCalled()
    expect(combobox()).toHaveFocus()
    await waitFor(() => expect(list).not.toBeVisible())
  })

  it('finds options by their first letter, keeping Azerbaijani letters apart', async () => {
    const user = userEvent.setup()
    render(<CityField />)
    combobox().focus()
    await user.keyboard('ş') // opens the closed listbox at the match
    expect(combobox()).toHaveAttribute('aria-expanded', 'true')
    expect(activeLabel()).toBe('Şəki')
    now += 600
    await user.keyboard('s')
    expect(activeLabel()).toBe('Sumqayıt')
    now += 600
    await user.keyboard('G')
    expect(activeLabel()).toBe('Gəncə')
    now += 600
    // A repeated letter cycles: "b" → Bütün şəhərlər (wraps around), "b" again → Bakı
    await user.keyboard('b')
    expect(activeLabel()).toBe('Bütün şəhərlər')
    await user.keyboard('b')
    expect(activeLabel()).toBe('Bakı')
    now += 600
    // Letters typed together narrow the search
    await user.keyboard('lə')
    expect(activeLabel()).toBe('Lənkəran')
  })

  it('selects the active option on Tab, closes and moves focus on (WAI-ARIA)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CityField onChange={onChange} />)
    combobox().focus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await user.tab()
    expect(onChange).toHaveBeenCalledWith('baki')
    expect(combobox()).toHaveTextContent('Bakı')
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Axtar' })).toHaveFocus()
  })

  it('leaves the value alone when Tab passes a closed listbox', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CityField onChange={onChange} />)
    combobox().focus()
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Axtar' })).toHaveFocus()
  })

  it('selects an option by click and closes on a press outside', async () => {
    const user = userEvent.setup()
    render(<CityField />)
    await user.click(combobox())
    await user.click(screen.getByRole('option', { name: /Quba/ }))
    expect(combobox()).toHaveTextContent('Quba')
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
    expect(combobox()).toHaveFocus()

    await user.click(combobox())
    expect(screen.getByRole('option', { name: /Quba/ })).toHaveAttribute('aria-selected', 'true')
    await user.click(document.body)
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
    expect(combobox()).toHaveTextContent('Quba')
  })
})

describe('Listbox motion', () => {
  it('opens and closes without animation from the keyboard, animated from a click', async () => {
    const user = userEvent.setup()
    render(<CityField />)
    const list = () => document.getElementById(combobox().getAttribute('aria-controls')!)!
    combobox().focus()
    await user.keyboard('{ArrowDown}')
    expect(list()).toHaveAttribute('data-state', 'open')
    expect(list()).toHaveAttribute('data-instant')
    await user.keyboard('{Escape}')
    expect(list()).toHaveAttribute('data-state', 'closed')
    expect(list()).toHaveAttribute('data-instant')

    await user.click(combobox())
    expect(list()).toHaveAttribute('data-state', 'open')
    expect(list()).not.toHaveAttribute('data-instant')
  })
})
