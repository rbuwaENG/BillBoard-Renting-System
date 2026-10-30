import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useCreateCampaign } from './useCampaigns'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useCreateCampaign', () => {
  it('calls create_campaign with the draft billboard ids', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'campaign-1' },
      error: null,
    } as never)

    const { result } = renderHook(() => useCreateCampaign(), { wrapper })
    result.current.mutate({
      name: 'Summer push',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      billboardIds: ['billboard-1', 'billboard-2'],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('create_campaign', {
      p_name: 'Summer push',
      p_start_date: '2026-06-01',
      p_end_date: '2026-06-30',
      p_billboard_ids: ['billboard-1', 'billboard-2'],
    })
  })
})
