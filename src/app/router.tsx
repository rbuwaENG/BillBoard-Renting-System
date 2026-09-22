import { createBrowserRouter } from 'react-router-dom'
import { LoginPage, SignupPage } from '@/features/auth'
import { BillboardBrowsePage } from '@/features/billboards'
import { AdminDashboardPage } from '@/features/admin'
import { ProfilePage } from '@/features/profile'
import { RentorDashboardPage } from '@/features/rentor'
import { NotFoundPage } from './NotFoundPage'
import { RoleGuard } from './RoleGuard'
import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <BillboardBrowsePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      {
        path: 'profile',
        element: <RoleGuard allow={['renter', 'rentor', 'admin']} />,
        children: [{ index: true, element: <ProfilePage /> }],
      },
      {
        path: 'rentor',
        element: <RoleGuard allow={['rentor']} />,
        children: [{ index: true, element: <RentorDashboardPage /> }],
      },
      {
        path: 'admin',
        element: <RoleGuard allow={['admin']} />,
        children: [{ index: true, element: <AdminDashboardPage /> }],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
