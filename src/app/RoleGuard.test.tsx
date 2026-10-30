import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/hooks/useAuth'
import type { UserProfile } from '@/types'
import { RoleGuard } from './RoleGuard'

const initialAuth = useAuthStore.getState()

const RENTER: UserProfile = {
  uid: 'u1',
  displayName: 'Rita Renter',
  email: 'rita@example.com',
  role: 'renter',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/profile" element={<RoleGuard allow={['renter']} />}>
          <Route index element={<p>Profile page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  useAuthStore.setState(initialAuth, true)
})

describe('RoleGuard', () => {
  it('renders the page for an allowed role', () => {
    useAuthStore.setState({
      user: RENTER,
      isLoading: false,
      profileError: null,
    })
    renderGuard()
    expect(screen.getByText('Profile page')).toBeInTheDocument()
  })

  it('redirects to login when signed out', () => {
    useAuthStore.setState({ user: null, isLoading: false, profileError: null })
    renderGuard()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('offers a retry instead of redirecting when the profile failed to load', () => {
    const reloadProfile = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({
      user: null,
      isLoading: false,
      profileError: new Error('network down'),
      reloadProfile,
    })
    renderGuard()

    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your profile",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(reloadProfile).toHaveBeenCalledTimes(1)
  })

  it('keeps the retry state up (disabled) while the reload is in flight', () => {
    useAuthStore.setState({
      user: null,
      isLoading: true,
      profileError: new Error('network down'),
    })
    renderGuard()
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  })
})
