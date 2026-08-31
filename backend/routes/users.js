const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, getRoles, getUserDepartmentIds } = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

router.use(authenticate);
router.use(authorize('super_admin', 'admin'));

router.get('/', getUsers);
router.get('/roles', getRoles);
router.get('/:id/departments', async (req, res) => {
  try {
    const deptIds = await getUserDepartmentIds(req.params.id);
    res.json(deptIds);
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

router.post('/', [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role_id').isInt().withMessage('Role is required')
], validate, createUser);

router.put('/:id', [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role_id').isInt().withMessage('Role is required')
], validate, updateUser);

router.delete('/:id', deleteUser);

module.exports = router;
