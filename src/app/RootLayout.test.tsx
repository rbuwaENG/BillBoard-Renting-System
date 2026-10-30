import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/hooks/useAuth'
import { RootLayout } from './RootLayout'

const initialAuth = useAuthStore.getState()

function renderLayout() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: <RootLayout />,
      children: [{ index: true, element: <p>Browse page</p> }],
    },
  ])
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  useAuthStore.setState(initialAuth, true)
})

describe('RootLayout', () => {
  it('shows a non-blocking retry banner when the profile failed to load', () => {
    const reloadProfile = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({
      user: null,
      isLoading: false,
      profileError: new Error('network down'),
      reloadProfile,
    })
    renderLayout()

    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't load your profile",
    )
    // The page underneath still renders.
    expect(screen.getByText('Browse page')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(reloadProfile).toHaveBeenCalledTimes(1)
  })

  it('shows no banner when there is no profile error', () => {
    useAuthStore.setState({ user: null, isLoading: false, profileError: null })
    renderLayout()
    expect(screen.getByText('Browse page')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
