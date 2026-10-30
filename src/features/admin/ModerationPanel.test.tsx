import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import type { BillboardWithDetails } from '@/features/billboards/useBillboards'
import { ModerationPanel } from './ModerationPanel'
import * as useAdminBillboardsModule from './useAdminBillboards'
import * as useCurrencySettingModule from './useCurrencySetting'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function makeBillboard(
  overrides: Partial<BillboardWithDetails>,
): BillboardWithDetails {
  return {
    id: overrides.id ?? 'b1',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    title: overrides.title ?? 'Billboard',
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
    status: overrides.status ?? 'active',
    district: null,
    trafficLevel: null,
    rating: overrides.rating ?? { avg: 0, count: 0 },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as BillboardWithDetails
}

type PagedResult = ReturnType<
  typeof useAdminBillboardsModule.useAdminBillboardsPaged
>

function mockPaged(items: BillboardWithDetails[]) {
  return vi
    .spyOn(useAdminBillboardsModule, 'useAdminBillboardsPaged')
    .mockImplementation(
      (filter) =>
        ({
          items:
            filter === 'all' ? items : items.filter((b) => b.status === filter),
          isLoading: false,
          error: null,
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: vi.fn(),
          refetch: vi.fn(),
        }) as unknown as PagedResult,
    )
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  render(<ModerationPanel />, { wrapper: Wrapper })
  return { invalidate }
}

function setupCommonMocks() {
  vi.spyOn(
    useAdminBillboardsModule,
    'useFlaggedBillboardCount',
  ).mockReturnValue({
    data: 1,
  } as ReturnType<typeof useAdminBillboardsModule.useFlaggedBillboardCount>)
  vi.spyOn(useCurrencySettingModule, 'useFormatPrice').mockReturnValue(
    (amount: number) => `$${amount}`,
  )
}

describe('ModerationPanel', () => {
  it('filters to flagged billboards and sorts them first', () => {
    setupCommonMocks()
    mockPaged([
      makeBillboard({ id: 'active-1', title: 'Active One', status: 'active' }),
      makeBillboard({
        id: 'flagged-1',
        title: 'Flagged One',
        status: 'flagged',
        rating: { avg: 4.5, count: 3 },
      }),
    ])

    renderPanel()

    expect(screen.getByText('Active One')).toBeInTheDocument()
    expect(screen.getByText('Flagged One')).toBeInTheDocument()
    expect(screen.getByText('4.5 (3 reviews)')).toBeInTheDocument()
    const titles = screen.getAllByText(/One$/).map((el) => el.textContent)
    expect(titles).toEqual(['Flagged One', 'Active One'])

    fireEvent.click(screen.getByRole('button', { name: /flagged \(1\)/i }))

    expect(screen.queryByText('Active One')).not.toBeInTheDocument()
    expect(screen.getByText('Flagged One')).toBeInTheDocument()
  })

  it('filters the loaded rows with the search box', () => {
    setupCommonMocks()
    mockPaged([
      makeBillboard({ id: 'a', title: 'Galle Road LED' }),
      makeBillboard({ id: 'b', title: 'Kandy Junction' }),
    ])

    renderPanel()
    fireEvent.change(
      screen.getByRole('searchbox', { name: /search loaded billboards/i }),
      {
        target: { value: 'kandy' },
      },
    )

    expect(screen.queryByText('Galle Road LED')).not.toBeInTheDocument()
    expect(screen.getByText('Kandy Junction')).toBeInTheDocument()
  })

  it('requires a reason to flag, then calls the RPC and refreshes the moderation list', async () => {
    setupCommonMocks()
    mockPaged([
      makeBillboard({ id: 'bb-1', title: 'Galle Road LED', status: 'active' }),
    ])
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never)

    const { invalidate } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Flag' }))

    const dialog = await screen.findByRole('dialog')
    const confirm = screen.getByRole('button', { name: 'Flag listing' })
    expect(dialog).toBeInTheDocument()
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/reason \(sent to the owner\)/i), {
      target: { value: 'Photos do not match the site' },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('admin_set_billboard_status', {
        p_billboard_id: 'bb-1',
        p_status: 'flagged',
        p_reason: 'Photos do not match the site',
      }),
    )
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['admin-billboards'],
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('keeps the dialog open and shows the server error when the change fails', async () => {
    setupCommonMocks()
    mockPaged([
      makeBillboard({ id: 'bb-1', title: 'Galle Road LED', status: 'flagged' }),
    ])
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Billboard not found' },
    } as never)

    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }))

    expect(await screen.findByText('Billboard not found')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a loading state instead of an empty message while fetching', () => {
    setupCommonMocks()
    vi.spyOn(
      useAdminBillboardsModule,
      'useAdminBillboardsPaged',
    ).mockReturnValue({
      items: [],
      isLoading: true,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    } as unknown as PagedResult)

    renderPanel()
    expect(screen.getByRole('status')).toHaveTextContent(/loading billboards/i)
    expect(screen.queryByText(/no billboards/i)).not.toBeInTheDocument()
  })
})
