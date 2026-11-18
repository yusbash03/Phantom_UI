import { createBrowserRouter } from 'react-router'
import { HomeRedirect } from '@/app/HomeRedirect'
import { RequireAuth } from '@/app/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { AccountPage } from '@/features/account/AccountPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFoundPage } from '@/features/NotFoundPage'
import { UsersPage } from '@/features/users/UsersPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'account', element: <AccountPage /> },
      {
        path: 'admin/users',
        element: (
          <RequireAuth roles={['Administrator']}>
            <UsersPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
