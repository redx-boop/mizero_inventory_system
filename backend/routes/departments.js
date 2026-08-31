const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/', getDepartments);
router.get('/:id', getDepartment);

router.post('/', authorize('super_admin', 'admin'), [
  body('name').notEmpty().withMessage('Department name is required')
], validate, createDepartment);

router.put('/:id', authorize('super_admin', 'admin'), [
  body('name').notEmpty().withMessage('Department name is required')
], validate, updateDepartment);

router.delete('/:id', authorize('super_admin'), deleteDepartment);

module.exports = router;
