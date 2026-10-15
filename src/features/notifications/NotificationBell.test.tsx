import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import type { Notification } from '@/types'
import { NotificationBell } from './NotificationBell'
import * as useNotificationsModule from './useNotifications'

// useNotifications.ts (via useAuth) imports the real Supabase client, which
// opens a background auth listener — mock it out so this test doesn't spin
// up a real GoTrueClient per run.
vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    userId: 'user-1',
    type: 'booking_approved',
    message: 'Your booking request was approved.',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    userId: 'user-1',
    type: 'booking_requested',
    message: 'New booking request received.',
    read: true,
    createdAt: new Date().toISOString(),
  },
]

describe('NotificationBell', () => {
  it('shows the unread count and marks notifications read on open', async () => {
    const markRead = vi.fn()
    vi.spyOn(useNotificationsModule, 'useMyNotifications').mockReturnValue({
      data: NOTIFICATIONS,
    } as ReturnType<typeof useNotificationsModule.useMyNotifications>)
    vi.spyOn(useNotificationsModule, 'useMarkNotificationsRead').mockReturnValue({
      mutate: markRead,
    } as unknown as ReturnType<typeof useNotificationsModule.useMarkNotificationsRead>)

    render(<NotificationBell />)

    expect(screen.getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Notifications'))

    expect(screen.getByText('Your booking request was approved.')).toBeInTheDocument()
    expect(markRead).toHaveBeenCalledWith(['n1'])
  })
})
