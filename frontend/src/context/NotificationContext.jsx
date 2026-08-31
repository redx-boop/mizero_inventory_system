import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 60000; // 60 seconds polling interval — reduced from 30s to lower server load
const MAX_NOTIFS = 50;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [hasNewNotif, setHasNewNotif] = useState(false);
  const pollingRef = useRef(null);
  const hasNewNotifTimerRef = useRef(null);
  const isVisibleRef = useRef(true);

  // Track page visibility to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ============ API Fetch Helpers ============

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(prev => {
        if (data.count > prev && prev > 0) {
          setHasNewNotif(true);
          if (hasNewNotifTimerRef.current) clearTimeout(hasNewNotifTimerRef.current);
          hasNewNotifTimerRef.current = setTimeout(() => setHasNewNotif(false), 5000);
        }
        return data.count;
      });
    } catch {
      // silently fail
    }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications?limit=20');
      setNotifications(data);
    } catch {
      // silently fail
    }
  }, [user]);

  const markAsRead = useCallback(async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }, []);

  const deleteNotification = useCallback(async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  }, []);

  // ============ Polling Fallback ============

  // Fetch initial data on mount/user change — only once
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    fetchUnreadCount();
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Polling with visibility-based pausing
  // Only fetches unread count during polling; full notifications fetch only on dropdown open
  useEffect(() => {
    if (!user) return;

    const poll = () => {
      if (!isVisibleRef.current) return; // Skip poll if tab is hidden
      fetchUnreadCount();
    };

    pollingRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Memoize provider value to prevent unnecessary re-renders of consumers
  const value = useMemo(() => ({
    unreadCount,
    notifications,
    hasNewNotif,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setUnreadCount,
  }), [
    unreadCount,
    notifications,
    hasNewNotif,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
