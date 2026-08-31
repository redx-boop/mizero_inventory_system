const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getLeftovers, createLeftover } = require('../controllers/leftoverController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getLeftovers);

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), [
  body('stock_out_id').isInt().withMessage('Stock out record is required'),
  body('returned_quantity').isInt({ min: 1 }).withMessage('Return quantity must be positive')
], validate, createLeftover);

module.exports = router;
