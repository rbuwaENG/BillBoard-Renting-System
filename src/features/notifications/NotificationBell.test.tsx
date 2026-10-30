import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/hooks/useAuth'
import type { Notification } from '@/types'
import { NotificationBell } from './NotificationBell'
import * as useNotificationsModule from './useNotifications'

// useNotifications.ts (via useAuth) imports the real Supabase client, which
// opens a background auth listener — mock it out so this test doesn't spin
// up a real GoTrueClient per run.
vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    userId: 'user-1',
    type: 'booking_approved',
    message: 'Your booking request was approved.',
    read: false,
    refId: 'booking-1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    userId: 'user-1',
    type: 'review_received',
    message: 'Your billboard received a new review.',
    read: true,
    createdAt: new Date().toISOString(),
  },
]

function mockNotifications(markRead = vi.fn()) {
  vi.spyOn(useNotificationsModule, 'useMyNotifications').mockReturnValue({
    data: NOTIFICATIONS,
  } as ReturnType<typeof useNotificationsModule.useMyNotifications>)
  vi.spyOn(useNotificationsModule, 'useMarkNotificationsRead').mockReturnValue({
    mutate: markRead,
  } as unknown as ReturnType<
    typeof useNotificationsModule.useMarkNotificationsRead
  >)
  return markRead
}

afterEach(() => {
  useAuthStore.setState({ user: null })
})

describe('NotificationBell', () => {
  it('shows the unread count and marks notifications read on open', () => {
    const markRead = mockNotifications()

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )

    expect(screen.getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Notifications'))

    expect(
      screen.getByText('Your booking request was approved.'),
    ).toBeInTheDocument()
    expect(markRead).toHaveBeenCalledWith(['n1'])
  })

  it('links a renter booking notification to the booking and closes on Escape', () => {
    mockNotifications()
    useAuthStore.setState({
      user: {
        uid: 'user-1',
        displayName: 'Rita',
        email: 'rita@example.test',
        role: 'renter',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
      },
    })

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByTitle('Notifications'))

    const link = screen.getByRole('link', { name: /approved/ })
    expect(link).toHaveAttribute('href', '/?booking=booking-1')
    // review notifications have no renter destination → plain text, no link
    expect(screen.queryByRole('link', { name: /new review/ })).toBeNull()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('Your booking request was approved.')).toBeNull()
  })
})
