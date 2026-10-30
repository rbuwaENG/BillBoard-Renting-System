import { render, screen } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from './RouteError'

function Boom(): never {
  throw new Error('kaboom')
}

function renderRoutes(initialPath: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <div>
            <header>Site header</header>
            <Outlet />
          </div>
        ),
        errorElement: <RouteErrorBoundary fullScreen />,
        children: [
          { index: true, element: <p>Home page</p> },
          {
            path: 'broken',
            element: <Boom />,
            errorElement: <RouteErrorBoundary />,
          },
          {
            path: 'broken-chunk',
            lazy: () =>
              Promise.reject(
                new TypeError(
                  'Failed to fetch dynamically imported module: /assets/x.js',
                ),
              ),
            errorElement: <RouteErrorBoundary />,
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  )
  return render(<RouterProvider router={router} />)
}

describe('RouteErrorBoundary', () => {
  // React and react-router log caught render errors; keep the output clean.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a friendly error inside the layout with recovery actions', async () => {
    renderRoutes('/broken')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument()
    // Nested boundary keeps the layout around it.
    expect(screen.getByText('Site header')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('explains a failed lazy chunk load', async () => {
    renderRoutes('/broken-chunk')

    expect(
      await screen.findByRole('heading', { name: 'Update available' }),
    ).toBeInTheDocument()
  })

  it('reloads the page on "Try again"', async () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      reload,
    })
    renderRoutes('/broken')

    ;(await screen.findByRole('button', { name: 'Try again' })).click()
    expect(reload).toHaveBeenCalledOnce()
  })
})
