const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getAdjustments, createAdjustment } = require('../controllers/stockAdjustmentController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getAdjustments);

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), [
  body('item_id').isInt().withMessage('Item is required'),
  body('adjustment_type').isIn(['increase', 'decrease']).withMessage('Adjustment type must be increase or decrease'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive number'),
  body('reason').notEmpty().withMessage('Reason is required')
], validate, createAdjustment);

module.exports = router;
