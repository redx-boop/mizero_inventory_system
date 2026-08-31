import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotificationBell from '../components/NotificationBell'

// ===================================================================
// Mock Data
// ===================================================================

const createMockNotif = (overrides = {}) => ({
  id: 1,
  user_id: 1,
  title: 'Test Notification',
  message: 'This is a test notification message',
  type: 'info',
  module: 'test',
  route: null,
  actor: null,
  reference_id: null,
  is_read: 0,
  created_at: new Date().toISOString(),
  ...overrides,
})

const sampleNotifications = [
  createMockNotif({ id: 1, title: 'New Stock Request', type: 'success', module: 'requests', message: 'Staff member requested 5 of Laptop Dell XPS' }),
  createMockNotif({ id: 2, title: 'Low Stock Alert', type: 'warning', module: 'inventory', message: 'Item "Whiteboard Markers" has low stock. Current quantity: 2, Minimum: 5.' }),
  createMockNotif({ id: 3, title: 'Damage Reported', type: 'danger', module: 'damage_liabilities', message: '2 of Office Chair by John Doe reported as damaged.' }),
  createMockNotif({ id: 4, title: 'Request Approved', type: 'success', module: 'requests', message: 'Your request for 10 of A4 Paper Box has been approved.', is_read: 1 }),
  createMockNotif({ id: 5, title: 'System Update', type: 'info', module: 'system', message: 'System maintenance completed successfully.' }),
]

// ===================================================================
// Mock NotificationContext
// ===================================================================

let mockContext = {
  unreadCount: 3,
  notifications: sampleNotifications.slice(0, 3),
  hasNewNotif: false,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  fetchUnreadCount: vi.fn(),
  fetchNotifications: vi.fn(),
  setUnreadCount: vi.fn(),
}

vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => mockContext,
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ===================================================================
// Helpers
// ===================================================================

function renderBell() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NotificationBell />
    </MemoryRouter>
  )
}

function openDropdown() {
  const bell = screen.getByTitle(/notifications/i)
  fireEvent.click(bell)
}

/**
 * Find a notification card by its title text (now a <div> with cursor-pointer)
 */
function findNotifCard(titleText) {
  const title = screen.getByText(titleText)
  return title.closest('.cursor-pointer')
}

// ===================================================================
// Tests
// ===================================================================

describe('🔔 NotificationBell — Bell Button & Badge', () => {
  beforeEach(() => {
    mockContext = {
      ...mockContext,
      unreadCount: 3,
      notifications: sampleNotifications.slice(0, 3),
      hasNewNotif: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    }
    mockNavigate.mockClear()
  })

  it('renders the bell button', () => {
    renderBell()
    const bell = screen.getByTitle(/notifications/i)
    expect(bell).toBeInTheDocument()
  })

  it('shows badge with unread count', () => {
    renderBell()
    const badge = screen.getByText('3')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('notification-badge')
  })

  it('hides badge when count is 0', () => {
    mockContext.unreadCount = 0
    renderBell()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows "99+" when count exceeds 99', () => {
    mockContext.unreadCount = 150
    renderBell()
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('shows "99+" when count is exactly 100', () => {
    mockContext.unreadCount = 100
    renderBell()
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('shows numeric badge when count is between 1 and 99', () => {
    mockContext.unreadCount = 5
    renderBell()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows numeric badge for count 50', () => {
    mockContext.unreadCount = 50
    renderBell()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('sets aria-label with unread count', () => {
    renderBell()
    const bell = screen.getByLabelText(/notifications/i)
    expect(bell).toHaveAttribute('aria-label', 'Notifications (3 unread)')
  })

  it('sets aria-label without unread count when count is 0', () => {
    mockContext.unreadCount = 0
    renderBell()
    const bell = screen.getByLabelText(/notifications/i)
    expect(bell).toHaveAttribute('aria-label', 'Notifications')
  })

  it('applies bell-active class when unreadCount > 0', () => {
    renderBell()
    const bell = screen.getByTitle(/notifications/i)
    expect(bell.className).toContain('bell-active')
  })

  it('does not apply bell-active class when unreadCount is 0', () => {
    mockContext.unreadCount = 0
    renderBell()
    const bell = screen.getByTitle(/notifications/i)
    expect(bell.className).not.toContain('bell-active')
  })

  it('applies bell-ring class when hasNewNotif is true', () => {
    mockContext.hasNewNotif = true
    renderBell()
    const bellIcon = document.querySelector('.bell-ring')
    expect(bellIcon).toBeInTheDocument()
  })

  it('does not apply bell-ring class when hasNewNotif is false', () => {
    mockContext.hasNewNotif = false
    renderBell()
    expect(document.querySelector('.bell-ring')).not.toBeInTheDocument()
  })
})

// ===================================================================
// Dropdown — Open / Close Behavior
// ===================================================================

describe('🔽 NotificationBell — Dropdown Open/Close', () => {
  beforeEach(() => {
    mockContext = {
      ...mockContext,
      unreadCount: 3,
      notifications: sampleNotifications.slice(0, 3),
      hasNewNotif: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    }
    mockNavigate.mockClear()
  })

  it('dropdown is hidden by default', () => {
    renderBell()
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument()
  })

  it('opens dropdown when bell is clicked', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('3 unread')).toBeInTheDocument()
  })

  it('closes dropdown when bell is clicked again', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Notifications')).toBeInTheDocument()

    const bell = screen.getByTitle(/notifications/i)
    fireEvent.click(bell)
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('closes dropdown when Escape key is pressed', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Notifications')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Notifications')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('does not close dropdown when clicking inside the dropdown', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Notifications')).toBeInTheDocument()

    const header = screen.getByText('Notifications').closest('div')
    if (header) fireEvent.mouseDown(header)
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  it('shows "View all notifications" link at bottom', () => {
    renderBell()
    openDropdown()
    const viewAllLink = screen.getByText('View all notifications')
    expect(viewAllLink).toBeInTheDocument()
    expect(viewAllLink.closest('a')).toHaveAttribute('href', '/notifications')
  })
})

// ===================================================================
// Dropdown — Notification List & Empty State
// ===================================================================

describe('🔽 NotificationBell — Notification List', () => {
  beforeEach(() => {
    mockContext = {
      ...mockContext,
      unreadCount: 3,
      notifications: sampleNotifications.slice(0, 3),
      hasNewNotif: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    }
    mockNavigate.mockClear()
  })

  it('shows empty state when there are no notifications', () => {
    mockContext.notifications = []
    mockContext.unreadCount = 0
    renderBell()
    openDropdown()
    expect(screen.getByText('No notifications yet')).toBeInTheDocument()
  })

  it('does not show "No notifications yet" when notifications exist', () => {
    renderBell()
    openDropdown()
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
  })

  it('renders notification titles in the dropdown', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('New Stock Request')).toBeInTheDocument()
    expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
    expect(screen.getByText('Damage Reported')).toBeInTheDocument()
  })

  it('renders notification messages', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText(/Staff member requested 5 of Laptop Dell XPS/)).toBeInTheDocument()
    expect(screen.getByText(/Item "Whiteboard Markers"/)).toBeInTheDocument()
    expect(screen.getByText(/2 of Office Chair by John Doe/)).toBeInTheDocument()
  })

  it('shows module badges for each notification', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('requests')).toBeInTheDocument()
    expect(screen.getByText('inventory')).toBeInTheDocument()
    expect(screen.getByText('damage_liabilities')).toBeInTheDocument()
  })

  it('shows only the first 5 notifications', () => {
    mockContext.notifications = sampleNotifications
    renderBell()
    openDropdown()
    expect(screen.getByText('New Stock Request')).toBeInTheDocument()
    expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
    expect(screen.getByText('Damage Reported')).toBeInTheDocument()
    expect(screen.getByText('Request Approved')).toBeInTheDocument()
    expect(screen.getByText('System Update')).toBeInTheDocument()
  })

  it('shows unread indicator (blue dot) for unread notifications', () => {
    renderBell()
    openDropdown()
    const unreadNotif = findNotifCard('New Stock Request')
    expect(unreadNotif).toBeInTheDocument()
  })

  it('shows "Mark all read" button when unreadCount > 0', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Mark all read')).toBeInTheDocument()
  })

  it('hides "Mark all read" button when unreadCount is 0', () => {
    mockContext.unreadCount = 0
    mockContext.notifications = sampleNotifications.filter(n => n.is_read)
    renderBell()
    openDropdown()
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument()
  })
})

// ===================================================================
// Dropdown — Interactions (Mark as Read, Delete, Navigate)
// ===================================================================

describe('🔽 NotificationBell — Interactions', () => {
  beforeEach(() => {
    mockContext = {
      ...mockContext,
      unreadCount: 3,
      notifications: sampleNotifications.slice(0, 3),
      hasNewNotif: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    }
    mockNavigate.mockClear()
  })

  it('calls markAsRead when clicking an unread notification', () => {
    renderBell()
    openDropdown()

    const notifCard = findNotifCard('New Stock Request')
    expect(notifCard).toBeInTheDocument()
    fireEvent.click(notifCard)

    expect(mockContext.markAsRead).toHaveBeenCalledWith(1)
  })

  it('does not call markAsRead when clicking a read notification', () => {
    mockContext.notifications = [
      createMockNotif({ id: 4, title: 'Request Approved', type: 'success', module: 'requests', message: 'Approved.', is_read: 1 }),
    ]
    mockContext.unreadCount = 0

    renderBell()
    openDropdown()

    const notifCard = findNotifCard('Request Approved')
    expect(notifCard).toBeInTheDocument()
    fireEvent.click(notifCard)

    expect(mockContext.markAsRead).not.toHaveBeenCalled()
  })

  it('calls markAllAsRead when clicking "Mark all read"', () => {
    renderBell()
    openDropdown()

    fireEvent.click(screen.getByText('Mark all read'))
    expect(mockContext.markAllAsRead).toHaveBeenCalledTimes(1)
  })

  it('closes dropdown when "View all notifications" is clicked', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Notifications')).toBeInTheDocument()

    const viewAllLink = screen.getByText('View all notifications')
    fireEvent.click(viewAllLink)

    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('navigates to route when clicking a notification with module mapping', () => {
    renderBell()
    openDropdown()

    const notifCard = findNotifCard('Damage Reported')
    fireEvent.click(notifCard)

    expect(mockNavigate).toHaveBeenCalledWith('/damage-liabilities')
  })

  it('navigates to explicit route when notification has route field', () => {
    mockContext.notifications = [
      createMockNotif({ id: 10, title: 'Custom Route', module: 'inventory', route: '/stock-in' }),
    ]
    mockContext.unreadCount = 1

    renderBell()
    openDropdown()

    const notifCard = findNotifCard('Custom Route')
    fireEvent.click(notifCard)

    expect(mockNavigate).toHaveBeenCalledWith('/stock-in')
  })

  it('navigates to /notifications fallback when module has no route mapping', () => {
    mockContext.notifications = [
      createMockNotif({ id: 10, title: 'Unknown Module', module: 'unknown_module', route: null }),
    ]
    mockContext.unreadCount = 1

    renderBell()
    openDropdown()

    const notifCard = findNotifCard('Unknown Module')
    fireEvent.click(notifCard)

    expect(mockNavigate).toHaveBeenCalledWith('/notifications')
  })

  it('calls deleteNotification when delete button is clicked', () => {
    renderBell()
    openDropdown()

    // Find the delete button (trash icon) inside the first notification card
    const notifCard = findNotifCard('New Stock Request')
    const deleteBtn = notifCard.querySelector('[title="Clear notification"]')
    expect(deleteBtn).toBeInTheDocument()

    fireEvent.click(deleteBtn)
    expect(mockContext.deleteNotification).toHaveBeenCalledWith(1) // id of first notif
  })

  it('does not call markAsRead when delete button is clicked (stopPropagation)', () => {
    renderBell()
    openDropdown()

    const notifCard = findNotifCard('New Stock Request')
    const deleteBtn = notifCard.querySelector('[title="Clear notification"]')
    fireEvent.click(deleteBtn)

    // markAsRead should NOT have been called because stopPropagation prevented it
    expect(mockContext.markAsRead).not.toHaveBeenCalled()
  })
})

// ===================================================================
// Notification Type Icons & Colors
// ===================================================================

describe('🔽 NotificationBell — Type Icons & Styling', () => {
  beforeEach(() => {
    mockContext = {
      ...mockContext,
      unreadCount: 4,
      notifications: sampleNotifications,
      hasNewNotif: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    }
    mockNavigate.mockClear()
  })

  it('renders notifications with different type styles', () => {
    renderBell()
    openDropdown()

    expect(screen.getByText('New Stock Request')).toBeInTheDocument()
    expect(screen.getByText('Low Stock Alert')).toBeInTheDocument()
    expect(screen.getByText('Damage Reported')).toBeInTheDocument()
    expect(screen.getByText('Request Approved')).toBeInTheDocument()
    expect(screen.getByText('System Update')).toBeInTheDocument()
  })

  it('renders different notification types with correct module badges', () => {
    renderBell()
    openDropdown()

    const inventoryBadges = screen.getAllByText('inventory')
    expect(inventoryBadges.length).toBeGreaterThanOrEqual(1)

    const damageBadges = screen.getAllByText('damage_liabilities')
    expect(damageBadges.length).toBeGreaterThanOrEqual(1)

    const systemBadges = screen.getAllByText('system')
    expect(systemBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('uses bold font weight for unread notification titles', () => {
    renderBell()
    openDropdown()

    const unreadTitle = screen.getByText('New Stock Request')
    expect(unreadTitle.className).toContain('font-bold')
  })

  it('uses medium font weight for read notification titles', () => {
    renderBell()
    openDropdown()

    const readTitle = screen.getByText('Request Approved')
    expect(readTitle.className).toContain('font-medium')
    expect(readTitle.className).not.toContain('font-bold')
  })
})

// ===================================================================
// Time Ago Formatting
// ===================================================================

describe('⏰ NotificationBell — Time Ago Display', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:00:00Z'))

    mockContext = {
      ...mockContext,
      unreadCount: 1,
      notifications: [createMockNotif({ id: 1, title: 'Time Test', created_at: new Date().toISOString() })],
      hasNewNotif: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    }
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('displays "Just now" for notifications created within the last minute', () => {
    renderBell()
    openDropdown()
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  it('displays "Xm ago" for notifications created minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    mockContext.notifications = [createMockNotif({ id: 2, title: 'Minutes Ago', created_at: fiveMinutesAgo })]

    renderBell()
    openDropdown()
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('displays "Xh ago" for notifications created hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    mockContext.notifications = [createMockNotif({ id: 3, title: 'Hours Ago', created_at: threeHoursAgo })]

    renderBell()
    openDropdown()
    expect(screen.getByText('3h ago')).toBeInTheDocument()
  })

  it('displays "Xd ago" for notifications created days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    mockContext.notifications = [createMockNotif({ id: 4, title: 'Days Ago', created_at: twoDaysAgo })]

    renderBell()
    openDropdown()
    expect(screen.getByText('2d ago')).toBeInTheDocument()
  })
})

// ===================================================================
// Edge Cases
// ===================================================================

describe('🧪 NotificationBell — Edge Cases', () => {
  beforeEach(() => {
    mockContext = {
      ...mockContext,
      unreadCount: 0,
      notifications: [],
      hasNewNotif: false,
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    }
    mockNavigate.mockClear()
  })

  it('handles very long notification messages without breaking layout', () => {
    mockContext.notifications = [createMockNotif({
      id: 1,
      title: 'Very Long Title ' + 'A'.repeat(100),
      message: 'X'.repeat(500),
      type: 'info',
    })]
    mockContext.unreadCount = 1

    renderBell()
    openDropdown()
    expect(screen.getByText(/Very Long Title/)).toBeInTheDocument()
  })

  it('handles undefined notification type gracefully (defaults to info)', () => {
    mockContext.notifications = [createMockNotif({
      id: 1,
      title: 'Undefined Type',
      type: undefined,
    })]
    mockContext.unreadCount = 1

    renderBell()
    openDropdown()
    expect(screen.getByText('Undefined Type')).toBeInTheDocument()
  })

  it('handles null notification type gracefully (defaults to info)', () => {
    mockContext.notifications = [createMockNotif({
      id: 1,
      title: 'Null Type',
      type: null,
    })]
    mockContext.unreadCount = 1

    renderBell()
    openDropdown()
    expect(screen.getByText('Null Type')).toBeInTheDocument()
  })

  it('handles notifications without route field (backward compatible)', () => {
    mockContext.notifications = [createMockNotif({
      id: 1,
      title: 'No Route',
      route: null,
      module: 'inventory',
    })]
    mockContext.unreadCount = 1

    renderBell()
    openDropdown()

    const notifCard = findNotifCard('No Route')
    fireEvent.click(notifCard)

    // Should navigate using module map
    expect(mockNavigate).toHaveBeenCalledWith('/inventory')
  })

  it('hides navigate indicator for unknown modules', () => {
    mockContext.notifications = [createMockNotif({
      id: 1,
      title: 'Unknown',
      route: null,
      module: 'something_unknown',
    })]
    mockContext.unreadCount = 1

    renderBell()
    openDropdown()

    const notifCard = findNotifCard('Unknown')
    fireEvent.click(notifCard)

    // Should fall back to /notifications
    expect(mockNavigate).toHaveBeenCalledWith('/notifications')
  })
})
