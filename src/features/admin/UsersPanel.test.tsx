import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'
import * as useAuthModule from '@/hooks/useAuth'
import { UsersPanel } from './UsersPanel'
import * as useUsersModule from './useUsers'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function user(overrides: Partial<UserProfile>): UserProfile {
  return {
    uid: 'u1',
    displayName: 'Someone',
    email: 'someone@example.com',
    role: 'renter',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPanel(users: UserProfile[]) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user: { uid: 'me' },
  } as unknown as ReturnType<typeof useAuthModule.useAuth>)
  vi.spyOn(useUsersModule, 'useAllUsers').mockReturnValue({
    data: users,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useUsersModule.useAllUsers>)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  render(<UsersPanel />, { wrapper: Wrapper })
}

describe('UsersPanel', () => {
  it('asks for confirmation before promoting to admin', async () => {
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(updateBuilder as never)
    renderPanel([user({ uid: 'u1', displayName: 'Kamal' })])

    fireEvent.click(
      screen.getByRole('button', { name: 'Promote to admin: Kamal' }),
    )
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      /full admin access/i,
    )
    expect(supabase.from).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Promote to admin' }))

    await waitFor(() =>
      expect(updateBuilder.update).toHaveBeenCalledWith({ role: 'admin' }),
    )
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'u1')
  })

  it('demotes an admin to the chosen role', async () => {
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(updateBuilder as never)
    renderPanel([user({ uid: 'u2', displayName: 'Sita', role: 'admin' })])

    fireEvent.click(screen.getByRole('button', { name: 'Demote Sita' }))
    fireEvent.change(await screen.findByLabelText('New role'), {
      target: { value: 'rentor' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove admin access' }))

    await waitFor(() =>
      expect(updateBuilder.update).toHaveBeenCalledWith({ role: 'rentor' }),
    )
  })

  it("disables demote/suspend on the admin's own row and filters by search", () => {
    renderPanel([
      user({ uid: 'me', displayName: 'Me Admin', role: 'admin' }),
      user({ uid: 'u3', displayName: 'Other Person' }),
    ])

    expect(
      screen.getByRole('button', { name: 'Demote Me Admin' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Suspend Me Admin' }),
    ).toBeDisabled()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search users' }), {
      target: { value: 'other' },
    })
    expect(screen.queryByText('Me Admin')).not.toBeInTheDocument()
    expect(screen.getByText('Other Person')).toBeInTheDocument()
  })
})
