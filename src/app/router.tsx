import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { NotFoundPage } from './NotFoundPage'
import { RoleGuard } from './RoleGuard'
import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteError'

// Every page is code-split with react-router's route-level `lazy`: the
// router fetches a page's chunk before it commits the navigation (the old
// page stays up meanwhile, with <NavigationProgress> in the layout), and a
// chunk that fails to load lands in the nearest `errorElement` instead of
// white-screening. Only the layout, guard and error/404 pages ship in the
// entry chunk.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    // Last resort: the layout itself failed, so replace the whole screen.
    errorElement: <RouteErrorBoundary fullScreen />,
    children: [
      {
        // Pathless wrapper so any page error renders inside the layout,
        // keeping the header/nav usable.
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/features/billboards'))
                .BillboardBrowsePage,
            }),
          },
          {
            path: 'login',
            lazy: async () => ({
              Component: (await import('@/features/auth')).LoginPage,
            }),
          },
          {
            path: 'signup',
            lazy: async () => ({
              Component: (await import('@/features/auth')).SignupPage,
            }),
          },
          {
            path: 'forgot-password',
            lazy: async () => ({
              Component: (await import('@/features/auth')).ForgotPasswordPage,
            }),
          },
          {
            path: 'reset-password',
            lazy: async () => ({
              Component: (await import('@/features/auth')).ResetPasswordPage,
            }),
          },
          {
            path: 'billboards/:id',
            lazy: async () => ({
              Component: (await import('@/features/billboards')).BillboardPage,
            }),
          },
          {
            path: 'profile',
            element: <RoleGuard allow={['renter', 'rentor', 'admin']} />,
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/profile')).ProfilePage,
                }),
              },
            ],
          },
          {
            path: 'rentor',
            element: <RoleGuard allow={['rentor']} />,
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/rentor'))
                    .RentorDashboardPage,
                }),
              },
            ],
          },
          {
            path: 'admin',
            element: <RoleGuard allow={['admin']} />,
            errorElement: <RouteErrorBoundary />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (await import('@/features/admin'))
                    .AdminDashboardPage,
                }),
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
