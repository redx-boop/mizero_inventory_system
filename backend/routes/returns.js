const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getReturns, createReturn } = require('../controllers/returnController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getReturns);

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), [
  body('borrowing_id').isInt().withMessage('Borrowing ID is required'),
  body('returned_quantity').isInt({ min: 1 }).withMessage('Return quantity must be positive'),
  body('return_date').isDate().withMessage('Return date is required')
], validate, createReturn);

module.exports = router;
