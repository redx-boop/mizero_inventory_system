const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getLiabilities, createLiability, recordPayment, waiveLiability,
  getLiabilityReceipt, getPaymentHistory, markAsPaid,
  getDamageReport, getLossReport, getOutstandingReport, getPaidReport
} = require('../controllers/damageLiabilityController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

// Main list
router.get('/', getLiabilities);

// Create liability (damage or loss)
router.post('/', authorize('super_admin', 'admin', 'stock_manager'), [
  body('borrowing_id').isInt().withMessage('Borrowing ID is required'),
  body('returned_quantity').isInt({ min: 1 }).withMessage('Quantity must be positive'),
  body('liability_type').optional().isIn(['damaged', 'lost']).withMessage('Liability type must be "damaged" or "lost"')
], validate, createLiability);

// Liability Reports
router.get('/reports/damage', authorize('super_admin', 'admin', 'stock_manager'), getDamageReport);
router.get('/reports/loss', authorize('super_admin', 'admin', 'stock_manager'), getLossReport);
router.get('/reports/outstanding', authorize('super_admin', 'admin', 'stock_manager'), getOutstandingReport);
router.get('/reports/paid', authorize('super_admin', 'admin', 'stock_manager'), getPaidReport);

// Waive liability
router.post('/:id/waive', authorize('super_admin', 'admin'), [
  body('reason').optional().isString()
], validate, waiveLiability);

// Payment routes
router.post('/:id/pay', authorize('super_admin', 'admin', 'stock_manager'), [
  body('payment_amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be positive')
], validate, recordPayment);

router.get('/:id/payments', getPaymentHistory);
router.get('/:id/receipt', getLiabilityReceipt);

// Legacy single-click full payment
router.put('/:id/pay', authorize('super_admin', 'admin', 'stock_manager'), markAsPaid);

module.exports = router;
