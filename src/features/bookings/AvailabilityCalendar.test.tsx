import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AvailabilityCalendar } from './AvailabilityCalendar'
import type { DateSelection } from './availability'

const TODAY = '2026-10-30'
const BOOKED = [{ startDate: '2026-11-05', endDate: '2026-11-07' }]

function Harness({
  onChange,
  initial = { startDate: '', endDate: '' },
}: {
  onChange?: (v: DateSelection) => void
  initial?: DateSelection
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <AvailabilityCalendar
        today={TODAY}
        value={value}
        bookedRanges={BOOKED}
        onChange={(v) => {
          setValue(v)
          onChange?.(v)
        }}
      />
      <output data-testid="value">
        {value.startDate}|{value.endDate}
      </output>
    </>
  )
}

const day = (label: RegExp) => screen.getByRole('button', { name: label })

describe('AvailabilityCalendar', () => {
  it('labels days with full dates and disables past and booked days', () => {
    render(<Harness />)
    expect(
      screen.getByRole('grid', { name: 'Booking dates, October 2026' }),
    ).toBeInTheDocument()

    const past = day(/^Thursday, October 29, 2026/)
    expect(past).toHaveAttribute('aria-disabled', 'true')
    expect(past).toHaveAccessibleName('Thursday, October 29, 2026, unavailable')

    const today = day(/^Friday, October 30, 2026/)
    expect(today).not.toHaveAttribute('aria-disabled')
    expect(today).toHaveAccessibleName('Friday, October 30, 2026, today')
    // Roving tabindex starts on today.
    expect(today).toHaveAttribute('tabindex', '0')

    // Previous month is unreachable (all in the past).
    expect(
      screen.getByRole('button', { name: 'Previous month' }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    const booked = day(/^Thursday, November 5, 2026/)
    expect(booked).toHaveAccessibleName('Thursday, November 5, 2026, booked')
    expect(booked).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Booked')).toBeInTheDocument()
  })

  it('selects a range with two clicks and emits local YYYY-MM-DD strings', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

    fireEvent.click(day(/^Sunday, November 1, 2026/))
    expect(onChange).toHaveBeenLastCalledWith({
      startDate: '2026-11-01',
      endDate: '',
    })
    fireEvent.click(day(/^Wednesday, November 4, 2026/))
    expect(onChange).toHaveBeenLastCalledWith({
      startDate: '2026-11-01',
      endDate: '2026-11-04',
    })
    expect(day(/^Monday, November 2, 2026/)).toHaveAccessibleName(
      'Monday, November 2, 2026, in selected range',
    )
    expect(
      screen.getByText(/Selected: Nov 1 – Nov 4, 2026/),
    ).toBeInTheDocument()
  })

  it('rejects a range across a booked day with the server message', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))

    fireEvent.click(day(/^Tuesday, November 3, 2026/))
    onChange.mockClear()
    fireEvent.click(day(/^Monday, November 9, 2026/))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Selected dates overlap an existing booking',
    )
    expect(screen.getByTestId('value')).toHaveTextContent('2026-11-03|')
  })

  it('ignores clicks on past and booked days', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.click(day(/^Thursday, October 29, 2026/))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    fireEvent.click(day(/^Friday, November 6, 2026/))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/already booked/)
  })

  it('is keyboard navigable: arrows move focus across months, Enter picks', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    const today = day(/^Friday, October 30, 2026/)
    today.focus()

    fireEvent.keyDown(today, { key: 'ArrowRight' })
    expect(document.activeElement).toHaveAccessibleName(
      'Saturday, October 31, 2026',
    )

    // Into November: the visible month follows focus.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(
      screen.getByRole('grid', { name: 'Booking dates, November 2026' }),
    ).toBeInTheDocument()
    expect(document.activeElement).toHaveAccessibleName(
      'Saturday, November 7, 2026, booked',
    )

    // Can't move focus into the past.
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' })
    expect(document.activeElement).toHaveAccessibleName(
      'Friday, October 30, 2026, today',
    )

    // Enter on a button activates it (native click).
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    fireEvent.click(document.activeElement!)
    expect(onChange).toHaveBeenLastCalledWith({
      startDate: '2026-10-31',
      endDate: '',
    })
  })

  it('clears the selection', () => {
    render(
      <Harness initial={{ startDate: '2026-11-01', endDate: '2026-11-02' }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByTestId('value')).toHaveTextContent('|')
  })
})
