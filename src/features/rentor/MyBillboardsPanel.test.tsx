import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import * as useCurrencySettingModule from '@/features/admin/useCurrencySetting'
import { MyBillboardsPanel } from './MyBillboardsPanel'
import * as billboardsModule from './useRentorBillboards'
import type { RentorBillboard } from './useRentorBillboards'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function makeBillboard(overrides: Partial<RentorBillboard>): RentorBillboard {
  return {
    id: 'b1',
    ownerId: 'owner-1',
    title: 'Riverside Board',
    description: '',
    categoryId: 'cat-1',
    sizeId: 'size-1',
    category: 'Retail',
    size: 'Large',
    location: { lat: 0, lng: 0, address: '', city: 'Colombo' },
    pricePerDay: 100,
    salePricePerDay: null,
    adminPriceOverridePerDay: null,
    images: [],
    status: 'active',
    district: null,
    trafficLevel: null,
    rating: { avg: 0, count: 0 },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

type MutateOptions = {
  onSuccess?: () => void
  onError?: (err: unknown) => void
}

function setup(billboards: RentorBillboard[]) {
  const setStatusMutate = vi.fn()
  const deleteMutate = vi.fn()
  vi.spyOn(billboardsModule, 'useRentorBillboards').mockReturnValue({
    data: billboards,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof billboardsModule.useRentorBillboards>)
  vi.spyOn(billboardsModule, 'useCreateBillboard').mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof billboardsModule.useCreateBillboard>)
  vi.spyOn(billboardsModule, 'useUpdateBillboard').mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof billboardsModule.useUpdateBillboard>)
  vi.spyOn(billboardsModule, 'useSetBillboardStatus').mockReturnValue({
    mutate: setStatusMutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof billboardsModule.useSetBillboardStatus>)
  vi.spyOn(billboardsModule, 'useDeleteBillboard').mockReturnValue({
    mutate: deleteMutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof billboardsModule.useDeleteBillboard>)
  vi.spyOn(useCurrencySettingModule, 'useFormatPrice').mockReturnValue(
    (amount: number) => `$${amount}`,
  )

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MyBillboardsPanel />
    </QueryClientProvider>,
  )
  return { setStatusMutate, deleteMutate }
}

describe('MyBillboardsPanel', () => {
  it('archives a listing by default from the remove dialog', () => {
    const { setStatusMutate, deleteMutate } = setup([makeBillboard({})])

    fireEvent.click(
      screen.getByRole('button', { name: 'Archive or delete Riverside Board' }),
    )
    expect(screen.getByRole('dialog')).toHaveTextContent(/archiving hides it/i)
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    expect(deleteMutate).not.toHaveBeenCalled()
    expect(setStatusMutate).toHaveBeenCalledWith(
      { id: 'b1', status: 'archived' },
      expect.anything(),
    )
    const options = setStatusMutate.mock.calls[0][1] as MutateOptions
    act(() => options.onSuccess?.())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('suggests archiving when a hard delete hits the bookings FK (23503)', () => {
    const { deleteMutate } = setup([makeBillboard({})])

    fireEvent.click(
      screen.getByRole('button', { name: 'Archive or delete Riverside Board' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(deleteMutate).toHaveBeenCalledWith('b1', expect.anything())

    const options = deleteMutate.mock.calls[0][1] as MutateOptions
    act(() =>
      options.onError?.({
        code: '23503',
        message:
          'update or delete on table "billboards" violates foreign key constraint',
      }),
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This listing has bookings — archive it instead.',
    )
    expect(
      screen.getByRole('button', { name: 'Delete permanently' }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides archived listings until "Show archived" is ticked, then unarchives', () => {
    const { setStatusMutate } = setup([
      makeBillboard({ id: 'b1', title: 'Live Board' }),
      makeBillboard({ id: 'b2', title: 'Old Board', status: 'archived' }),
    ])

    expect(screen.queryByText('Old Board')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/show archived \(1\)/i))
    expect(screen.getByText('Old Board')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /unarchive/i }))
    expect(setStatusMutate).toHaveBeenCalledWith({
      id: 'b2',
      status: 'inactive',
    })
  })

  it('hides the power toggle on flagged listings and explains why', () => {
    setup([makeBillboard({ status: 'flagged' })])

    expect(
      screen.queryByRole('button', { name: /activate riverside board/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/flagged by an admin/i)).toBeInTheDocument()
  })

  it('shows the admin price override on the listing row', () => {
    setup([makeBillboard({ adminPriceOverridePerDay: 80 })])
    expect(screen.getByText(/admin price · yours \$100/i)).toBeInTheDocument()
    expect(screen.getByText('$80')).toBeInTheDocument()
  })
})
