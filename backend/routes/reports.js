const express = require('express');
const router = express.Router();

const {
  getInventoryStatusReport,
  getStockInReport,
  getStockOutReport,
  getAdjustmentsReport,
  getBorrowingsReport,
  getReturnsReport,
  getRequestsReport,
  getLeftoversReport,
  getDamageLiabilitiesReport,
  getBudgetReport,
  getDepartmentInventoryReport,
  getSingleDepartmentReport,
} = require('../controllers/reportController');

const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');

// ✅ Protect all report routes
router.use(authenticate);

// Department-specific report — staff can access their own department
router.get('/department/:departmentId', getSingleDepartmentReport);

router.use(authorize('super_admin', 'admin', 'stock_manager'));

// 📄 Report endpoints
router.get('/inventory-status', getInventoryStatusReport);
router.get('/stock-in', getStockInReport);
router.get('/stock-out', getStockOutReport);
router.get('/adjustments', getAdjustmentsReport);
router.get('/borrowings', getBorrowingsReport);
router.get('/returns', getReturnsReport);
router.get('/requests', getRequestsReport);
router.get('/leftovers', getLeftoversReport);
router.get('/damage-liabilities', getDamageLiabilitiesReport);
router.get('/budgets', getBudgetReport);
router.get('/department-report', getDepartmentInventoryReport);

module.exports = router;