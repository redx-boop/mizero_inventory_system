const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getStockOut, createStockOut, getStockOutReceipt } = require('../controllers/stockOutController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getStockOut);

router.get('/:id/receipt', getStockOutReceipt);

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), [
  body('item_id').isInt().withMessage('Item is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive number'),
  body('recipient').notEmpty().withMessage('Recipient is required')
], validate, createStockOut);

module.exports = router;
