import { useState, useCallback } from 'react';
import mizeroLogo from '../assets/logo/mizerologo.png';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HiOutlineViewGrid, HiOutlineCube, HiOutlineArrowSmRight, HiOutlineArrowSmLeft,
  HiOutlineAdjustments, HiOutlineClipboardList, HiOutlineReply, HiOutlineDocumentReport,
  HiOutlineUsers, HiOutlineOfficeBuilding, HiOutlineBell, HiOutlineClipboardCheck,
  HiOutlineLogout, HiOutlineMenu, HiOutlineX,
  HiOutlineChartBar, HiOutlineRefresh, HiOutlineUser, HiOutlineChartPie, HiOutlineSun, HiOutlineMoon
} from 'react-icons/hi';
import NotificationBell from '../components/NotificationBell';

// Static menu config — defined outside component to avoid recreation on every render
const MENU_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: HiOutlineViewGrid, roles: ['super_admin', 'admin', 'stock_manager', 'staff'] },
      { label: 'Analytics', path: '/analytics', icon: HiOutlineChartPie, roles: ['super_admin', 'admin', 'stock_manager'] },
    ]
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Inventory', path: '/inventory', icon: HiOutlineCube, roles: ['super_admin', 'admin', 'stock_manager', 'staff'] },
      { label: 'Stock In', path: '/stock-in', icon: HiOutlineArrowSmRight, roles: ['super_admin', 'admin', 'stock_manager'] },
      { label: 'Stock Out', path: '/stock-out', icon: HiOutlineArrowSmLeft, roles: ['super_admin', 'admin', 'stock_manager'] },
      { label: 'Adjustments', path: '/adjustments', icon: HiOutlineAdjustments, roles: ['super_admin', 'admin', 'stock_manager'] },
    ]
  },
  {
    label: 'Transactions',
    items: [
      { label: 'Borrowings', path: '/borrowings', icon: HiOutlineClipboardList, roles: ['super_admin', 'admin', 'stock_manager'] },
      { label: 'Returns', path: '/returns', icon: HiOutlineReply, roles: ['super_admin', 'admin', 'stock_manager'] },
      { label: 'Requests', path: '/requests', icon: HiOutlineClipboardCheck, roles: ['super_admin', 'admin', 'stock_manager', 'staff'] },
      { label: 'Leftovers', path: '/leftovers', icon: HiOutlineRefresh, roles: ['super_admin', 'admin', 'stock_manager'] },
    ]
  },
  {
    label: 'Partners',
    items: [
      { label: 'Suppliers', path: '/suppliers', icon: HiOutlineOfficeBuilding, roles: ['super_admin', 'admin', 'stock_manager'] },
    ]
  },
  {
    label: 'Finance',
    items: [
      { label: 'Damage & Loss', path: '/damage-liabilities', icon: HiOutlineClipboardCheck, roles: ['super_admin', 'admin', 'stock_manager'] },
      { label: 'Budget', path: '/budget', icon: HiOutlineOfficeBuilding, roles: ['super_admin', 'admin'] },
    ]
  },
  {
    label: 'Reports',
    items: [
      { label: 'Reports', path: '/reports', icon: HiOutlineDocumentReport, roles: ['super_admin', 'admin', 'stock_manager'] },
    ]
  },
  {
    label: 'Administration',
    items: [
      { label: 'Departments', path: '/departments', icon: HiOutlineOfficeBuilding, roles: ['super_admin', 'admin'] },
      { label: 'Users', path: '/users', icon: HiOutlineUsers, roles: ['super_admin', 'admin'] },
      { label: 'Activity Logs', path: '/activity-logs', icon: HiOutlineChartBar, roles: ['super_admin', 'admin', 'stock_manager'] },
    ]
  },
  {
    label: 'Personal',
    items: [
      { label: 'Notifications', path: '/notifications', icon: HiOutlineBell, roles: ['super_admin', 'admin', 'stock_manager', 'staff'] },
      { label: 'Profile', path: '/profile', icon: HiOutlineUser, roles: ['super_admin', 'admin', 'stock_manager', 'staff'] },
    ]
  },
];

export default function MainLayout({ children }) {
  const { user, logout, hasRole } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/');
  }, [logout, navigate]);

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Mobile overlay — always rendered, faded in/out with transitions */}
      <div
        className={`fixed inset-0 z-20 lg:hidden transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'opacity-100 pointer-events-auto backdrop-blur-sm' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col
        transform transition-all duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0 lg:shadow-none'}
      `} style={{ backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--border-color)' }}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <img
              src={mizeroLogo}
              alt="Mizero Inventory Hub"
              className="h-12 w-auto object-contain transition-all duration-300 group-hover:scale-105"
              style={{
                filter: 'drop-shadow(0 2px 6px rgba(139, 158, 255, 0.2))'
              }}
            />
            <div>
              <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Mizero</span>
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-disabled)' }}>Inventory Hub</p>
            </div>
          </Link>
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" style={{ color: 'var(--text-muted)' }} onClick={() => setSidebarOpen(false)}>
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6 min-h-0">
          {MENU_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item =>
              item.roles.some(role => hasRole(role))
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-disabled)' }}>
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`sidebar-link ${isActive ? 'active' : ''} group`}
                      >
                        <Icon className="w-5 h-5 shrink-0 transition-all duration-150" style={{ color: isActive ? '' : 'var(--text-muted)' }} />
                        <span>{item.label}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom: User */}
        <div className="p-4 pt-3 shrink-0" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-3 px-2 mb-3 py-2 rounded-xl transition-all duration-150" style={{ backgroundColor: 'var(--sidebar-hover)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent-violet))', boxShadow: '0 2px 8px rgba(139, 158, 255, 0.3)' }}>
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user?.full_name || 'User'}</p>
              <p className="text-[11px] font-semibold capitalize truncate" style={{ color: 'var(--text-muted)' }}>{user?.role?.replace(/_/g, ' ') || 'staff'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-link w-full justify-start" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <HiOutlineLogout className="w-5 h-5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 shrink-0" style={{ backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" style={{ color: 'var(--text-secondary)' }} onClick={() => setSidebarOpen(true)}>
              <HiOutlineMenu className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: 'var(--text-muted)' }}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <HiOutlineSun className="w-5 h-5" /> : <HiOutlineMoon className="w-5 h-5" />}
            </button>
            <NotificationBell />
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-primary)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
