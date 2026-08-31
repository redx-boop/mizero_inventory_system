import { useState, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle,
  HiOutlineExclamation, HiOutlineCheck, HiOutlineTrash, HiOutlineClock,
  HiOutlineFilter
} from 'react-icons/hi';

const NOTIF_STYLES = {
  success: {
    icon: HiOutlineCheckCircle,
    bg: 'rgba(34, 197, 94, 0.12)',
    color: 'var(--accent-green)',
    label: 'Success',
  },
  warning: {
    icon: HiOutlineExclamation,
    bg: 'rgba(245, 158, 11, 0.12)',
    color: 'var(--accent-yellow)',
    label: 'Warning',
  },
  info: {
    icon: HiOutlineInformationCircle,
    bg: 'rgba(139, 158, 255, 0.12)',
    color: 'var(--primary)',
    label: 'Info',
  },
  danger: {
    icon: HiOutlineExclamationCircle,
    bg: 'rgba(239, 68, 68, 0.12)',
    color: 'var(--accent-red)',
    label: 'Danger',
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

export default function Notifications() {
  const { notifications, markAsRead, markAllAsRead, fetchNotifications, unreadCount } = useNotifications();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  useEffect(() => {
    if (notifications.length === 0) {
      fetchNotifications();
    }
  }, []);

  const filteredNotifs = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleClearAll = async () => {
    try {
      // Delete read notifications older than 30 days
      await api.delete('/notifications/cleanup');
      toast.success('Old notifications cleaned up');
      fetchNotifications();
    } catch {
      toast.error('Failed to clean up notifications');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Notifications
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Stay updated with system alerts and events
            {unreadCount > 0 && (
              <span className="ml-2 font-semibold" style={{ color: 'var(--primary)' }}>
                ({unreadCount} unread)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <HiOutlineCheckCircle className="w-4 h-4" /> Mark All Read
            </button>
          )}
          <button
            onClick={handleClearAll}
            className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
            style={{ color: 'var(--text-muted)' }}
          >
            <HiOutlineTrash className="w-4 h-4" /> Clean Up
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <HiOutlineFilter className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
            filter === 'all' ? 'chip-active' : 'chip-inactive'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
            filter === 'unread' ? 'chip-active' : 'chip-inactive'
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {filteredNotifs.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl border"
            style={{
              color: 'var(--text-muted)',
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--border-color)',
            }}
          >
            <HiOutlineInformationCircle className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>
              {filter === 'unread'
                ? 'All caught up! Great job.'
                : 'Notifications will appear here when events occur.'}
            </p>
          </div>
        ) : (
          filteredNotifs.map((n) => {
            const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.info;
            const Icon = style.icon;

            return (
              <div
                key={n.id}
                className="flex items-start gap-4 rounded-xl border px-5 py-4 transition-all duration-200 hover:shadow-sm"
                style={{
                  backgroundColor: !n.is_read
                    ? 'rgba(139, 158, 255, 0.03)'
                    : 'var(--card-bg)',
                  borderColor: !n.is_read
                    ? 'var(--primary)'
                    : 'var(--border-color)',
                  borderLeft: !n.is_read
                    ? `4px solid var(--primary)`
                    : '1px solid var(--border-color)',
                }}
              >
                {/* Type Icon */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: style.bg,
                    color: style.color,
                    border: `1px solid ${style.bg}`,
                  }}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={`text-sm truncate max-w-[300px] ${
                            !n.is_read ? 'font-bold' : 'font-medium'
                          }`}
                          style={{
                            color: !n.is_read
                              ? 'var(--text-primary)'
                              : 'var(--text-secondary)',
                          }}
                        >
                          {n.title}
                        </h3>
                        {/* Type Badge */}
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: style.bg,
                            color: style.color,
                          }}
                        >
                          {style.label}
                        </span>
                        {/* Module */}
                        <span
                          className="text-[10px] font-medium capitalize px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {n.module}
                        </span>
                      </div>
                      <p
                        className="text-sm mt-1 line-clamp-2"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="text-xs flex items-center gap-1"
                          style={{ color: 'var(--text-disabled)' }}
                        >
                          <HiOutlineClock className="w-3.5 h-3.5" />
                          {getTimeAgo(n.created_at)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.is_read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="rounded-lg p-2 transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
                          style={{ color: 'var(--primary)' }}
                          title="Mark as read"
                        >
                          <HiOutlineCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
