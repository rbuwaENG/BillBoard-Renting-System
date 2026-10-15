import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BillboardWithDetails } from '@/features/billboards/useBillboards'
import { ModerationPanel } from './ModerationPanel'
import * as useAdminBillboardsModule from './useAdminBillboards'
import * as useRentorBillboardsModule from '@/features/rentor/useRentorBillboards'
import * as useCurrencySettingModule from './useCurrencySetting'

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

describe('ModerationPanel', () => {
  it('filters to flagged billboards and sorts them first', () => {
    const billboards = [
      makeBillboard({ id: 'active-1', title: 'Active One', status: 'active' }),
      makeBillboard({
        id: 'flagged-1',
        title: 'Flagged One',
        status: 'flagged',
        rating: { avg: 4.5, count: 3 },
      }),
    ]
    vi.spyOn(useAdminBillboardsModule, 'useAdminBillboards').mockReturnValue({
      data: billboards,
    } as ReturnType<typeof useAdminBillboardsModule.useAdminBillboards>)
    vi.spyOn(useRentorBillboardsModule, 'useSetBillboardStatus').mockReturnValue({
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useRentorBillboardsModule.useSetBillboardStatus>)
    vi.spyOn(useAdminBillboardsModule, 'useSetAdminPriceOverride').mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useAdminBillboardsModule.useSetAdminPriceOverride>)
    vi.spyOn(useCurrencySettingModule, 'useFormatPrice').mockReturnValue(
      (amount: number) => `$${amount}`,
    )

    render(<ModerationPanel />)

    expect(screen.getByText('Active One')).toBeInTheDocument()
    expect(screen.getByText('Flagged One')).toBeInTheDocument()
    expect(screen.getByText('4.5 (3 reviews)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /flagged \(1\)/i }))

    expect(screen.queryByText('Active One')).not.toBeInTheDocument()
    expect(screen.getByText('Flagged One')).toBeInTheDocument()
  })
})
