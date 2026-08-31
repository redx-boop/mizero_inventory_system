const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getBorrowings, createBorrowing, getBorrowingReceipt, checkOverdue } = require('../controllers/borrowingController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getBorrowings);
router.post('/check-overdue', authorize('super_admin', 'admin'), checkOverdue);

router.get('/:id/receipt', getBorrowingReceipt);

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), [
  body('item_id').isInt().withMessage('Item is required'),
  body('department_id').isInt().withMessage('Department is required'),
  body('borrower_name').notEmpty().withMessage('Borrower name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive number'),
  body('borrow_date').isDate().withMessage('Borrow date is required'),
  body('due_date').isDate().withMessage('Due date is required'),
  body('due_date').custom((dueDate, { req }) => {
    if (new Date(dueDate) < new Date(req.body.borrow_date)) {
      throw new Error('Due date must be on or after the borrow date.');
    }
    return true;
  })
], validate, createBorrowing);

module.exports = router;
