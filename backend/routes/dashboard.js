const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(authenticate);

router.get('/', authorize('super_admin', 'admin', 'stock_manager', 'staff'), getDashboard);

module.exports = router;
