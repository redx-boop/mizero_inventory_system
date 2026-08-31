const pool = require('../config/db');

const getNotifications = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const [notifications] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, parseInt(limit), parseInt(offset)]
    );
    res.json(notifications);
  } catch (error) {
    req.log.error({ err: error }, 'Get notifications error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const markAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    // Unread count updated; frontend fetches via REST API polling

    res.json({ message: 'Notification marked as read.' });
  } catch (error) {
    req.log.error({ err: error }, 'Mark as read error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    // Unread count updated; frontend fetches via REST API polling

    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    req.log.error({ err: error }, 'Mark all as read error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count: result[0].count });
  } catch (error) {
    req.log.error({ err: error }, 'Get unread count error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const cleanupNotifications = async (req, res) => {
  try {
    // Delete read notifications older than 30 days
    const [result] = await pool.query(
      `DELETE FROM notifications WHERE is_read = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    res.json({
      message: `Cleaned up ${result.affectedRows} old read notifications.`,
      deleted_count: result.affectedRows
    });
  } catch (error) {
    req.log.error({ err: error }, 'Cleanup notifications error');
    res.status(500).json({ message: 'Server error.' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    // Unread count updated; frontend fetches via REST API polling

    res.json({ message: 'Notification deleted.' });
  } catch (error) {
    req.log.error({ err: error }, 'Delete notification error');
    res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, getUnreadCount, cleanupNotifications, deleteNotification };
