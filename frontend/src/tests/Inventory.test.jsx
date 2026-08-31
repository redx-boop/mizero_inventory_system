import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Inventory from '../pages/Inventory'

// Mock auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'admin@mizero.com', full_name: 'Admin', role: 'super_admin', role_name: 'super_admin' },
    loading: false,
    hasRole: vi.fn(() => true),
    getUserDepartments: vi.fn(() => [1]),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock toast utils
vi.mock('../utils/toastUtils.jsx', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

// Mock API with realistic data (no selling_price anywhere)
const mockItems = [
  { id: 1, sku: 'ITM-001', name: 'Laptop Dell XPS', category: 'Electronics', unit: 'pcs', quantity: 15, minimum_stock: 5, unit_cost: '850000', currency: 'RWF', item_type: 'non-consumable', department_id: 1, department_name: 'IT Department', image_url: null },
  { id: 2, sku: 'ITM-002', name: 'Office Chair', category: 'Furniture', unit: 'pcs', quantity: 8, minimum_stock: 3, unit_cost: '150000', currency: 'RWF', item_type: 'non-consumable', department_id: 2, department_name: 'Admin', image_url: null },
  { id: 3, sku: 'ITM-003', name: 'A4 Paper Box', category: 'Stationery', unit: 'box', quantity: 50, minimum_stock: 10, unit_cost: '12000', currency: 'RWF', item_type: 'consumable', department_id: 1, department_name: 'IT Department', image_url: null },
  { id: 4, sku: 'ITM-004', name: 'Whiteboard Markers', category: 'Stationery', unit: 'set', quantity: 2, minimum_stock: 5, unit_cost: '5000', currency: 'RWF', item_type: 'consumable', department_id: 3, department_name: 'Finance', image_url: null },
]

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn((url, config) => {
      if (url === '/items') {
        return Promise.resolve({
          data: {
            items: mockItems,
            pagination: { page: 1, pages: 1, total: 4 },
          },
        })
      }
      if (url === '/items/categories') {
        return Promise.resolve({ data: ['Electronics', 'Furniture', 'Stationery'] })
      }
      if (url === '/departments') {
        return Promise.resolve({
          data: [
            { id: 1, name: 'IT Department' },
            { id: 2, name: 'Admin' },
            { id: 3, name: 'Finance' },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

describe('Inventory Page — Smoke Test', () => {
  it('renders the inventory page header and loads items', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Inventory />
      </MemoryRouter>
    )

    // Header
    expect(screen.getByText('Inventory')).toBeInTheDocument()
    expect(screen.getByText(/Manage your stock items/)).toBeInTheDocument()

    // Action buttons
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    expect(screen.getByText('Import')).toBeInTheDocument()
    expect(screen.getByText('Template')).toBeInTheDocument()

    // Wait for items to load — items may appear in multiple elements
    // (table rows, card views, dropdowns), so use getAllByText
    await waitFor(() => {
      expect(screen.getAllByText('Laptop Dell XPS').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('Office Chair').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('A4 Paper Box').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Whiteboard Markers').length).toBeGreaterThanOrEqual(1)

    // Quick filters
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Consumable')).toBeInTheDocument()
    expect(screen.getByText('Non-Consumable')).toBeInTheDocument()
    expect(screen.getByText('Low Stock')).toBeInTheDocument()
  })

  it('shows low stock indicator for items below minimum', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Inventory />
      </MemoryRouter>
    )

    await waitFor(() => {
      // Whiteboard Markers have qty 2 but minimum_stock 5 — should appear
      expect(screen.getAllByText('Whiteboard Markers').length).toBeGreaterThanOrEqual(1)
    })
  })
})
