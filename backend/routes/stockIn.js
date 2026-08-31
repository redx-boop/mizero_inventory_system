const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getStockIn, createStockIn, getStockInReceipt } = require('../controllers/stockInController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getStockIn);

router.get('/:id/receipt', getStockInReceipt);

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), [
  body('item_id').isInt().withMessage('Item is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive number'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
  body('supplier_id').optional({ values: 'null' }).isInt().withMessage('Supplier must be a valid ID')
], validate, createStockIn);

module.exports = router;
