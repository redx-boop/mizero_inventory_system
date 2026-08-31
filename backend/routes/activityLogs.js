const express = require('express');
const router = express.Router();
const { getActivityLogs, cleanupActivityLogs } = require('../controllers/activityLogController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(authenticate);

router.get('/', authorize('super_admin', 'admin', 'stock_manager'), getActivityLogs);
router.delete('/cleanup', authorize('super_admin', 'admin'), cleanupActivityLogs);

module.exports = router;
