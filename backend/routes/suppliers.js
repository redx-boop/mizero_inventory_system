const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getSuppliers, getAllSuppliers, getSupplier,
  createSupplier, updateSupplier, deleteSupplier
} = require('../controllers/supplierController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

// Public (authenticated) endpoints
router.get('/', getSuppliers);
// NOTE: /all MUST come before /:id or Express will match 'all' as a parameter value
router.get('/all', getAllSuppliers);
router.get('/:id', getSupplier);

// Management endpoints
const requiredFields = [
  body('name').notEmpty().withMessage('Supplier name is required'),
  body('email').notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  body('phone').notEmpty().withMessage('Phone is required')
    .trim().isLength({ min: 6 }).withMessage('Phone must be at least 6 characters'),
  body('tax_id').notEmpty().withMessage('Tax ID is required'),
  body('address').notEmpty().withMessage('Address is required'),
];

router.post('/', authorize('super_admin', 'admin', 'stock_manager'), requiredFields, validate, createSupplier);

router.put('/:id', authorize('super_admin', 'admin', 'stock_manager'), requiredFields, validate, updateSupplier);

router.delete('/:id', authorize('super_admin', 'admin'), deleteSupplier);

module.exports = router;
