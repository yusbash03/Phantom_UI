import { createBrowserRouter } from 'react-router'
import { HomeRedirect } from '@/app/HomeRedirect'
import { RequireAuth } from '@/app/auth/RequireAuth'
import { AppShell } from '@/components/layout/AppShell'
import { AccountPage } from '@/features/account/AccountPage'
import { MyAssignmentsPage } from '@/features/assignments/MyAssignmentsPage'
import { AuditLogPage } from '@/features/audit/AuditLogPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { IncidentDetailPage } from '@/features/incidents/IncidentDetailPage'
import { IncidentListPage } from '@/features/incidents/IncidentListPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { OperationsMapPage } from '@/features/map/OperationsMapPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { RespondersPage } from '@/features/responders/RespondersPage'
import { NotFoundPage } from '@/features/NotFoundPage'
import { PublicReportPage } from '@/features/public-reporting/PublicReportPage'
import { PublicStatusPage } from '@/features/public-reporting/PublicStatusPage'
import { UsersPage } from '@/features/users/UsersPage'

export const router = createBrowserRouter([
  // Public — no auth required
  { path: '/report', element: <PublicReportPage /> },
  { path: '/report/status', element: <PublicStatusPage /> },
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
      { path: 'notifications', element: <NotificationsPage /> },
      {
        path: 'reports',
        element: (
          <RequireAuth roles={['Administrator', 'IncidentCoordinator']}>
            <ReportsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <RequireAuth roles={['Administrator', 'IncidentCoordinator']}>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      {
        path: 'incidents',
        element: (
          <RequireAuth roles={['Administrator', 'IncidentCoordinator']}>
            <IncidentListPage />
          </RequireAuth>
        ),
      },
      {
        path: 'map',
        element: (
          <RequireAuth roles={['Administrator', 'IncidentCoordinator']}>
            <OperationsMapPage />
          </RequireAuth>
        ),
      },
      {
        path: 'assignments',
        element: (
          <RequireAuth roles={['Responder']}>
            <MyAssignmentsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'responders',
        element: (
          <RequireAuth roles={['Administrator', 'IncidentCoordinator']}>
            <RespondersPage />
          </RequireAuth>
        ),
      },
      {
        path: 'incidents/:id',
        element: (
          <RequireAuth roles={['Administrator', 'IncidentCoordinator']}>
            <IncidentDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/settings',
        element: (
          <RequireAuth roles={['Administrator']}>
            <SettingsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/audit',
        element: (
          <RequireAuth roles={['Administrator']}>
            <AuditLogPage />
          </RequireAuth>
        ),
      },
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
