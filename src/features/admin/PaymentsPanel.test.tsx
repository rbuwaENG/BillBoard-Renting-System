import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { PaymentsPanel } from './PaymentsPanel'
import * as useCurrencySettingModule from './useCurrencySetting'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

const PENDING_ROW = {
  id: 'pay-1',
  booking_id: 'bk-1',
  amount: 500,
  currency: 'LKR',
  status: 'pending',
  reference: 'TRX-77',
  created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  confirmed_at: null,
  bookings: {
    id: 'bk-1',
    start_date: '2026-11-01',
    end_date: '2026-11-05',
    price_quoted: 500,
    status: 'payment_pending',
    billboards: { title: 'Galle Road LED' },
  },
  profiles: { display_name: 'Nimal' },
}

function pagedBuilder(data: unknown) {
  const builder = createQueryBuilderMock({ data, error: null })
  builder.range = vi.fn(() => builder)
  return builder
}

function renderPanel() {
  vi.spyOn(useCurrencySettingModule, 'useFormatPrice').mockReturnValue(
    (amount: number) => `LKR ${amount}`,
  )
  // payments → the pending submission (also shown in history); bookings → none awaiting.
  vi.mocked(supabase.from).mockImplementation(((table: string) =>
    table === 'payments'
      ? pagedBuilder([PENDING_ROW])
      : pagedBuilder([])) as never)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  render(<PaymentsPanel />, { wrapper: Wrapper })
}

async function findSubmissionCard() {
  const section = screen.getByRole('region', { name: 'Payment submissions' })
  await within(section).findByText('Galle Road LED')
  return section
}

describe('PaymentsPanel', () => {
  it('shows the pending submission with dates, renter and age', async () => {
    renderPanel()
    const section = await findSubmissionCard()
    expect(
      within(section).getByText(
        /Nimal · 2026-11-01 → 2026-11-05 · submitted 3h ago/,
      ),
    ).toBeInTheDocument()
    expect(within(section).getByText('TRX-77')).toBeInTheDocument()
  })

  it('prefills the quoted amount, requires a reference, warns on mismatch and shows server errors', async () => {
    renderPanel()
    const section = await findSubmissionCard()
    fireEvent.click(
      within(section).getByRole('button', { name: 'Confirm payment received' }),
    )

    const amount = within(section).getByLabelText(
      'Amount received',
    ) as HTMLInputElement
    const reference = within(section).getByLabelText(
      /payment reference/i,
    ) as HTMLInputElement
    const submit = within(section).getByRole('button', {
      name: 'Confirm received',
    })
    expect(amount.value).toBe('500')
    // Prefilled from the renter's submitted reference.
    expect(reference.value).toBe('TRX-77')

    fireEvent.change(reference, { target: { value: '' } })
    expect(submit).toBeDisabled()
    fireEvent.change(reference, { target: { value: 'BANK-1' } })
    expect(submit).toBeEnabled()

    fireEvent.change(amount, { target: { value: '450' } })
    expect(
      within(section).getByText(/amount differs from the quoted price/i),
    ).toBeInTheDocument()

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Amount does not match quoted price' },
    } as never)
    fireEvent.click(submit)

    expect(
      await within(section).findByText('Amount does not match quoted price'),
    ).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith('admin_confirm_payment', {
      p_booking_id: 'bk-1',
      p_amount: 450,
      p_reference: 'BANK-1',
    })
  })

  it('rejects a submission with a required reason', async () => {
    renderPanel()
    const section = await findSubmissionCard()
    fireEvent.click(within(section).getByRole('button', { name: 'Reject' }))

    const confirm = await screen.findByRole('button', {
      name: 'Reject payment',
    })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/reason \(sent to the renter\)/i), {
      target: { value: 'No transfer with this reference' },
    })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('admin_reject_payment', {
        p_payment_id: 'pay-1',
        p_reason: 'No transfer with this reference',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })
})
