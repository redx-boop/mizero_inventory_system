const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getRequests, createRequest, reviewRequest, cancelRequest, getRequestReceipt } = require('../controllers/requestController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getRequests);
router.get('/:id/receipt', getRequestReceipt);

router.post('/', [
  body('item_id').isInt().withMessage('Item is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive number')
], validate, createRequest);

router.put('/:id/review', authorize('super_admin', 'admin', 'stock_manager'), [
  body('status').isIn(['approved', 'rejected', 'allocated']).withMessage('Status must be approved, rejected, or allocated'),
  body('allocated_quantity').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Allocated quantity must be a positive number'),
  body('notes').optional({ values: 'falsy' }).isString().trim().withMessage('Notes must be text')
], validate, reviewRequest);

// Allow the requester or any admin/manager to cancel a pending request
router.put('/:id/cancel', cancelRequest);

module.exports = router;
