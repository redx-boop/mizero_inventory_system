const express = require('express');
const router = express.Router();
const { getBudgets, createBudget, updateBudget, deleteBudget, getBudgetSummary } = require('../controllers/budgetController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');

router.use(authenticate);
router.use(authorize('super_admin', 'admin'));

router.get('/summary', getBudgetSummary);
router.get('/', getBudgets);
router.post('/', createBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

module.exports = router;
