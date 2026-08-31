const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead, getUnreadCount, cleanupNotifications, deleteNotification } = require('../controllers/notificationController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(authenticate);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/:id/read', markAsRead);
router.patch('/read', markAllAsRead);
router.put('/read-all', markAllAsRead);
router.delete('/cleanup', authorize('super_admin', 'admin'), cleanupNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;
