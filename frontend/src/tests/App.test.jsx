import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

// Mock all lazy-loaded pages to avoid heavy imports
vi.mock('../pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}))

vi.mock('../pages/Dashboard', () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}))

vi.mock('../pages/Inventory', () => ({
  default: () => <div data-testid="inventory-page">Inventory Page</div>,
}))

vi.mock('../pages/StockIn', () => ({
  default: () => <div data-testid="stockin-page">StockIn Page</div>,
}))

vi.mock('../pages/StockOut', () => ({
  default: () => <div data-testid="stockout-page">StockOut Page</div>,
}))

vi.mock('../pages/Adjustments', () => ({
  default: () => <div data-testid="adjustments-page">Adjustments Page</div>,
}))

vi.mock('../pages/Borrowings', () => ({
  default: () => <div data-testid="borrowings-page">Borrowings Page</div>,
}))

vi.mock('../pages/Returns', () => ({
  default: () => <div data-testid="returns-page">Returns Page</div>,
}))

vi.mock('../pages/Requests', () => ({
  default: () => <div data-testid="requests-page">Requests Page</div>,
}))

vi.mock('../pages/Leftovers', () => ({
  default: () => <div data-testid="leftovers-page">Leftovers Page</div>,
}))

vi.mock('../pages/DamageLiabilities', () => ({
  default: () => <div data-testid="damage-liabilities-page">Damage Liabilities Page</div>,
}))

vi.mock('../pages/Budget', () => ({
  default: () => <div data-testid="budget-page">Budget Page</div>,
}))

vi.mock('../pages/Reports', () => ({
  default: () => <div data-testid="reports-page">Reports Page</div>,
}))

vi.mock('../pages/Departments', () => ({
  default: () => <div data-testid="departments-page">Departments Page</div>,
}))

vi.mock('../pages/Users', () => ({
  default: () => <div data-testid="users-page">Users Page</div>,
}))

vi.mock('../pages/Analytics', () => ({
  default: () => <div data-testid="analytics-page">Analytics Page</div>,
}))

vi.mock('../pages/ActivityLogs', () => ({
  default: () => <div data-testid="activity-logs-page">Activity Logs Page</div>,
}))

vi.mock('../pages/Notifications', () => ({
  default: () => <div data-testid="notifications-page">Notifications Page</div>,
}))

vi.mock('../pages/Profile', () => ({
  default: () => <div data-testid="profile-page">Profile Page</div>,
}))

vi.mock('../pages/ForcePasswordChange', () => ({
  default: () => <div data-testid="force-password-change-page">Force Password Change Page</div>,
}))

vi.mock('../pages/Suppliers', () => ({
  default: () => <div data-testid="suppliers-page">Suppliers Page</div>,
}))

// Mock MainLayout to just render children (no sidebar rendering needed)
vi.mock('../layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}))

// Mock AuthContext so we can control auth state per test
const mockUseAuth = vi.fn()
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// Shared mock user
const authedUser = {
  id: 1,
  email: 'admin@mizero.com',
  full_name: 'Admin',
  role: 'super_admin',
}

const guestState = {
  user: null,
  loading: false,
  hasRole: vi.fn(() => false),
  getUserDepartments: vi.fn(() => []),
}

const authedState = {
  user: authedUser,
  loading: false,
  hasRole: vi.fn(() => true),
  getUserDepartments: vi.fn(() => [1]),
}

describe('App Routing — Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReset() // prevent leaked return values between tests
  })

  it('redirects unauthenticated user from /dashboard to /login', async () => {
    mockUseAuth.mockReturnValue(guestState)

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  it('renders dashboard for authenticated user at /dashboard', async () => {
    mockUseAuth.mockReturnValue(authedState)

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })
  })

  it('redirects authenticated user from /login to /dashboard', async () => {
    mockUseAuth.mockReturnValue(authedState)

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
    })
  })

  it('renders ForcePasswordChange page for authenticated user', async () => {
    mockUseAuth.mockReturnValue(authedState)

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/force-password-change']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('force-password-change-page')).toBeInTheDocument()
    })
  })

  it('renders all protected pages with routes for authenticated user', async () => {
    mockUseAuth.mockReturnValue(authedState)

    const routes = [
      { path: '/inventory', testId: 'inventory-page' },
      { path: '/stock-in', testId: 'stockin-page' },
      { path: '/stock-out', testId: 'stockout-page' },
      { path: '/adjustments', testId: 'adjustments-page' },
      { path: '/borrowings', testId: 'borrowings-page' },
      { path: '/returns', testId: 'returns-page' },
      { path: '/requests', testId: 'requests-page' },
      { path: '/leftovers', testId: 'leftovers-page' },
      { path: '/damage-liabilities', testId: 'damage-liabilities-page' },
      { path: '/budget', testId: 'budget-page' },
      { path: '/reports', testId: 'reports-page' },
      { path: '/departments', testId: 'departments-page' },
      { path: '/users', testId: 'users-page' },
      { path: '/analytics', testId: 'analytics-page' },
      { path: '/activity-logs', testId: 'activity-logs-page' },
      { path: '/notifications', testId: 'notifications-page' },
      { path: '/profile', testId: 'profile-page' },
      { path: '/suppliers', testId: 'suppliers-page' },
    ]

    for (const { path, testId } of routes) {
      const { unmount } = render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument()
      }, { timeout: 5000 })

      unmount()
    }
  })
})
