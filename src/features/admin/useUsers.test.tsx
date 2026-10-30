import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useInviteAdmin, usePromoteToAdmin } from './useUsers'
// NOTE: the supabaseMock import above must stay before the '@/lib/supabase'
// import — vi.mock's factory runs the moment that import is evaluated, and
// would hit a TDZ error if createSupabaseMock weren't initialized yet.

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('usePromoteToAdmin', () => {
  it('updates the profile role to admin', async () => {
    const { result } = renderHook(() => usePromoteToAdmin(), { wrapper })
    result.current.mutate('user-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledWith('profiles')
  })
})

describe('useInviteAdmin', () => {
  it('invokes the admin-invite-user function with email and name', async () => {
    const { result } = renderHook(() => useInviteAdmin(), { wrapper })
    result.current.mutate({ email: 'new-admin@example.com', name: 'New Admin' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'admin-invite-user',
      {
        body: { email: 'new-admin@example.com', name: 'New Admin' },
      },
    )
  })

  it('surfaces a function-level error', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { error: 'Only an admin can invite new admins' },
      error: null,
    } as never)

    const { result } = renderHook(() => useInviteAdmin(), { wrapper })
    result.current.mutate({ email: 'x@example.com', name: '' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe(
      'Only an admin can invite new admins',
    )
  })
})
