import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Login from '../pages/Login'

// Mock useAuth for Login
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => false),
    getUserDepartments: vi.fn(() => []),
  }),
}))

describe('Login Page — Smoke Test', () => {
  it('renders the login form with all core elements', () => {
    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Login />
      </BrowserRouter>
    )

    // Branding
    expect(screen.getByText('Mizero Hub')).toBeInTheDocument()
    expect(screen.getByText('Inventory Management System')).toBeInTheDocument()

    // Form elements (labels lack htmlFor, so use placeholder text)
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()

    // Version text
    expect(screen.getByText(/mizero inventory hub v1\.0/i)).toBeInTheDocument()
  })

  it('has required email and password fields', () => {
    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Login />
      </BrowserRouter>
    )

    const emailInput = screen.getByPlaceholderText('Enter your email')
    const passwordInput = screen.getByPlaceholderText('Enter your password')

    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toBeRequired()
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toBeRequired()
  })
})
