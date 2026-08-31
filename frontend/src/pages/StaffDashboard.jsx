import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

import {
  HiOutlineClipboardCheck, HiOutlinePlus, HiOutlineEye,
  HiOutlineBell, HiOutlineSupport, HiOutlineCube,
  HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineClock,
  HiOutlineChevronRight, HiOutlineInformationCircle,
  HiOutlineExclamation, HiOutlineExclamationCircle
} from 'react-icons/hi';

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const NOTIF_STYLES = {
  success: { icon: HiOutlineCheckCircle, color: 'var(--accent-green)', bg: 'rgba(34, 197, 94, 0.12)' },
  warning: { icon: HiOutlineExclamation, color: 'var(--accent-yellow)', bg: 'rgba(245, 158, 11, 0.12)' },
  info: { icon: HiOutlineInformationCircle, color: 'var(--primary)', bg: 'rgba(139, 158, 255, 0.12)' },
  danger: { icon: HiOutlineExclamationCircle, color: 'var(--accent-red)', bg: 'rgba(239, 68, 68, 0.12)' },
};

const MODULE_ROUTES = {
  damage_liabilities: '/damage-liabilities',
  borrowing: '/borrowings',
  borrowings: '/borrowings',
  requests: '/requests',
  inventory: '/inventory',
  notifications: '/notifications',
};

function resolveRoute(notification) {
  if (notification.route) return notification.route;
  return MODULE_ROUTES[notification.module] || '/notifications';
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const { notifications, markAsRead, unreadCount } = useNotifications();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get('/dashboard');
        if (!cancelled) setData(data);
      } catch (error) {
        // Handled silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDashboard();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="loading-spinner" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const recentNotifs = notifications.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Welcome, {user?.full_name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Link
          to="/notifications"
          className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5"
          style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF' }}
        >
          <HiOutlineBell className="w-4 h-4" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#ef4444', color: '#FFFFFF' }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Stock Requests Section */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(139, 158, 255, 0.12)' }}>
              <HiOutlineClipboardCheck className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Stock Requests</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Submit and review inventory requests</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <Link to="/requests" className="btn-primary flex items-center gap-2">
            <HiOutlinePlus className="w-4 h-4" />
            New Request
          </Link>
          <Link to="/inventory" className="btn-secondary flex items-center gap-2">
            <HiOutlineEye className="w-4 h-4" />
            View Inventory
          </Link>
        </div>
      </div>

      {/* My Requests — Status Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <HiOutlineClipboardCheck className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>My Requests</h2>
          </div>
          <Link to="/requests" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--primary)' }}>
            View All <HiOutlineChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Pending */}
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)' }}>
            <HiOutlineClock className="w-5 h-5 mx-auto mb-1.5" style={{ color: '#f59e0b' }} />
            <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{data?.my_pending_requests || 0}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Pending</p>
          </div>
          {/* Approved */}
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)' }}>
            <HiOutlineCheckCircle className="w-5 h-5 mx-auto mb-1.5" style={{ color: '#3b82f6' }} />
            <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{data?.my_approved_requests || 0}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Approved</p>
          </div>
          {/* Rejected */}
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
            <HiOutlineXCircle className="w-5 h-5 mx-auto mb-1.5" style={{ color: '#ef4444' }} />
            <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>{data?.my_rejected_requests || 0}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Rejected</p>
          </div>
          {/* Allocated */}
          <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)' }}>
            <HiOutlineCheckCircle className="w-5 h-5 mx-auto mb-1.5" style={{ color: '#22c55e' }} />
            <p className="text-2xl font-bold" style={{ color: '#22c55e' }}>{data?.my_allocated_requests || 0}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>Allocated</p>
          </div>
        </div>
      </div>

      {/* Recent Notifications Panel */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <HiOutlineBell className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Recent Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#ef4444', color: '#FFFFFF' }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <Link to="/notifications" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: 'var(--primary)' }}>
            View All <HiOutlineChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="mt-4 space-y-1">
          {recentNotifs.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <HiOutlineBell className="w-10 h-10 mb-2" style={{ color: 'var(--text-disabled)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No notifications yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>
                Notifications will appear here when events occur.
              </p>
            </div>
          ) : (            recentNotifs.map((n) => {
              const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.info;
              const Icon = style.icon;
              const route = resolveRoute(n);
              return (
                <Link
                  key={n.id}
                  to={route}
                  onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
                  style={{
                    backgroundColor: !n.is_read ? 'rgba(139, 158, 255, 0.03)' : 'transparent',
                    borderLeft: !n.is_read ? '3px solid var(--primary)' : '3px solid transparent',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: style.bg, color: style.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${!n.is_read ? 'font-bold' : 'font-medium'}`} style={{ color: !n.is_read ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {n.title}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                      {n.message}
                    </p>
                    <span className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                      {getTimeAgo(n.created_at)}
                    </span>
                  </div>
                  <HiOutlineChevronRight className="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-disabled)' }} />
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <HiOutlineSupport className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/requests"
            className="flex items-center gap-3 p-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }}>
              <HiOutlinePlus className="w-5 h-5" style={{ color: '#22c55e' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Request Item</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Submit a stock request</p>
            </div>
          </Link>
          <Link
            to="/inventory"
            className="flex items-center gap-3 p-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(139, 158, 255, 0.12)' }}>
              <HiOutlineCube className="w-5 h-5" style={{ color: '#8B9EFF' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Browse Inventory</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>View available items</p>
            </div>
          </Link>
          <Link
            to="/notifications"
            className="flex items-center gap-3 p-4 rounded-xl transition-all duration-150 hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)' }}>
              <HiOutlineBell className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>View Notifications</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Check alerts & updates</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
