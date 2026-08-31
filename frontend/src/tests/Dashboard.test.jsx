import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../pages/Dashboard'

// Create a mutable mock for hasRole so we can change it per test
const mockHasRole = vi.fn(() => true)

// Mock auth context — super_admin by default
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'admin@mizero.com', full_name: 'Admin', role: 'super_admin', role_name: 'super_admin' },
    loading: false,
    hasRole: mockHasRole,
    getUserDepartments: vi.fn(() => [1]),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock theme context
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ dark: false, toggleTheme: vi.fn() }),
}))

// Mock AdminDashboard — check that it receives data
vi.mock('../pages/AdminDashboard', () => ({
  default: () => <div data-testid="admin-dashboard">
    <h1>Dashboard</h1>
    <p>Total Items</p>
    <p>Low Stock Items</p>
    <p>Borrowed Items</p>
    <p>Pending Requests</p>
    <p>Stock In vs Stock Out (7 Days)</p>
    <p>Inventory by Category</p>
    <p>Recent Activities</p>
    <p>Department Summary</p>
    <p>Stock in: Added 50 units of Pens</p>
    <p>Stock out: Issued 10 units of Chairs</p>
  </div>,
}))

// Mock StaffDashboard
vi.mock('../pages/StaffDashboard', () => ({
  default: () => <div data-testid="staff-dashboard">
    <p>My Department Inventory</p>
    <p>My Requests</p>
    <p>My Borrowings</p>
    <p>Low Stock Items</p>
  </div>,
}))

describe('Dashboard Page — Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasRole.mockClear()
  })

  it('renders AdminDashboard for super_admin/admin/stock_manager roles', () => {
    mockHasRole.mockImplementation((...roles) => roles.includes('super_admin'))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    )

    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('staff-dashboard')).not.toBeInTheDocument()
  })

  it('renders StaffDashboard for staff role', () => {
    mockHasRole.mockImplementation((...roles) => roles.includes('staff'))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>
    )

    expect(screen.getByTestId('staff-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-dashboard')).not.toBeInTheDocument()
  })
})
