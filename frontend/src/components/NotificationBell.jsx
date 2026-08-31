import { useState, useRef, useEffect, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import {
  HiOutlineBell, HiOutlineCheckCircle, HiOutlineChevronRight,
  HiOutlineExclamationCircle, HiOutlineCheck, HiOutlineInformationCircle,
  HiOutlineExclamation, HiOutlineClock, HiOutlineTrash
} from 'react-icons/hi';

/**
 * Route map — maps notification module to frontend route
 */
const MODULE_ROUTES = {
  damage_liabilities: '/damage-liabilities',
  stock_in: '/stock-in',
  stock_out: '/stock-out',
  borrowing: '/borrowings',
  borrowings: '/borrowings',
  returns: '/returns',
  requests: '/requests',
  adjustments: '/adjustments',
  inventory: '/inventory',
  suppliers: '/suppliers',
  users: '/users',
  analytics: '/analytics',
  dashboard: '/dashboard',
  notifications: '/notifications',
};

/**
 * Notification type icons and colors
 */
const NOTIF_STYLES = {
  success: {
    icon: HiOutlineCheckCircle,
    bg: 'rgba(34, 197, 94, 0.12)',
    color: 'var(--accent-green)',
    border: 'rgba(34, 197, 94, 0.2)',
  },
  warning: {
    icon: HiOutlineExclamation,
    bg: 'rgba(245, 158, 11, 0.12)',
    color: 'var(--accent-yellow)',
    border: 'rgba(245, 158, 11, 0.2)',
  },
  info: {
    icon: HiOutlineInformationCircle,
    bg: 'rgba(139, 158, 255, 0.12)',
    color: 'var(--primary)',
    border: 'rgba(139, 158, 255, 0.2)',
  },
  danger: {
    icon: HiOutlineExclamationCircle,
    bg: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--accent-red)',
    border: 'rgba(239, 68, 68, 0.2)',
  },
};

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

/**
 * Resolve the frontend route for a notification.
 * Priority: notification.route > module route map > /notifications
 */
function resolveRoute(notification) {
  if (notification.route) return notification.route;
  return MODULE_ROUTES[notification.module] || '/notifications';
}

const NotificationBell = memo(function NotificationBell() {
  const {
    unreadCount,
    notifications,
    hasNewNotif,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
  } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);

  // Fetch fresh notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  /**
   * Handle clicking a notification card:
   * 1. Mark as read (if unread)
   * 2. Navigate to the relevant module page
   * 3. Close the dropdown
   */
  const handleNotifClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    const route = resolveRoute(notification);
    setIsOpen(false);
    navigate(route);
  };

  /**
   * Handle delete/clear button click — stop propagation so the
   * card's main click handler doesn't fire.
   */
  const handleDelete = (e, id) => {
    e.stopPropagation();
    deleteNotification(id);
  };

  /**
   * Handle Mark all as read + stop propagation so dropdown stays open
   * until the user dismisses it.
   */
  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    markAllAsRead();
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;
  const recentNotifs = notifications.slice(0, 5);

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-all duration-200 ${
          unreadCount > 0
            ? 'bell-active'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{
          color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
          backgroundColor: unreadCount > 0 ? 'rgba(139, 158, 255, 0.1)' : 'transparent',
        }}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <HiOutlineBell
          className={`w-5 h-5 transition-transform duration-300 ${
            hasNewNotif ? 'bell-ring' : ''
          }`}
        />

        {/* Badge — 99+ for large values */}
        {unreadCount > 0 && (
          <span
            className="notification-badge"
            key={unreadCount}
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="notification-dropdown"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-color)' }}
          >
            <div>
              <h3
                className="text-sm font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                Notifications
              </h3>
              {unreadCount > 0 && (
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {unreadCount} unread
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ color: 'var(--primary)' }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <HiOutlineChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {recentNotifs.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 px-4"
                style={{ color: 'var(--text-muted)' }}
              >
                <HiOutlineBell className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-medium">No notifications yet</p>
              </div>
            ) : (
              recentNotifs.map((n) => {
                const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.info;
                const Icon = style.icon;
                const route = resolveRoute(n);

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className="w-full text-left px-4 py-3 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b last:border-b-0 cursor-pointer group"
                    style={{
                      borderColor: 'var(--border-color)',
                      backgroundColor: !n.is_read
                        ? 'rgba(139, 158, 255, 0.03)'
                        : 'transparent',
                      borderLeft: !n.is_read
                        ? '3px solid var(--primary)'
                        : '3px solid transparent',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type Icon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: style.bg,
                          color: style.color,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm truncate ${
                              !n.is_read ? 'font-bold' : 'font-medium'
                            }`}
                            style={{
                              color: !n.is_read
                                ? 'var(--text-primary)'
                                : 'var(--text-secondary)',
                            }}
                          >
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: 'var(--primary)' }}
                            />
                          )}
                        </div>
                        <p
                          className="text-xs mt-0.5 line-clamp-2"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="text-[10px] font-medium capitalize px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: style.bg,
                              color: style.color,
                            }}
                          >
                            {n.module}
                          </span>
                          <span
                            className="text-[10px] flex items-center gap-1"
                            style={{ color: 'var(--text-disabled)' }}
                          >
                            <HiOutlineClock className="w-3 h-3" />
                            {getTimeAgo(n.created_at)}
                          </span>
                          {/* Route indicator */}
                          {route !== '/notifications' && (
                            <span
                              className="text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--primary)' }}
                            >
                              <HiOutlineChevronRight className="w-2.5 h-2.5" />
                              Navigate
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete/Clear button */}
                      <button
                        onClick={(e) => handleDelete(e, n.id)}
                        className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-900/20"
                        style={{ color: 'var(--text-disabled)' }}
                        title="Clear notification"
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-disabled)'; }}
                      >
                        <HiOutlineTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all duration-150 rounded-b-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 border-t"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--primary)',
            }}
          >
            View all notifications
            <HiOutlineChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Inline styles for animations */}
      <style>{`
        @keyframes bellRing {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-12deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }
          50% { transform: rotate(6deg); }
          60% { transform: rotate(-4deg); }
          70% { transform: rotate(2deg); }
          80% { transform: rotate(-1deg); }
          100% { transform: rotate(0deg); }
        }

        @keyframes badgePop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }

        .bell-ring {
          animation: bellRing 0.6s ease-in-out;
        }

        .notification-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          min-width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #ef4444;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4);
          animation: badgePop 0.3s ease-out;
          line-height: 1;
        }

        .bell-active {
          position: relative;
        }

        .bell-active::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 10px;
          background: rgba(139, 158, 255, 0.08);
          animation: pulseGlow 2s ease-in-out infinite;
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .notification-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: -8px;
          width: 380px;
          max-width: calc(100vw - 32px);
          border-radius: 14px;
          z-index: 100;
          animation: dropdownSlide 0.2s ease-out;
        }

        @keyframes dropdownSlide {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
});

export default NotificationBell;
