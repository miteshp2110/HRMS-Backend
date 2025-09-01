const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getExpensesByEmployee,
} = require('../../controllers/expenses');

const router = express.Router();

router.use(authenticate);

// We'll use a specific 'expenses.manage' permission
router.post('/', authorize(['expenses.manage']), createExpense);
router.get('/:id', authorize(['expenses.manage']), getExpensesByEmployee);
router.get('/', authorize(['expenses.manage']), getExpenses);
router.patch('/:id', authorize(['expenses.manage']), updateExpense);
router.delete('/:id', authorize(['expenses.manage']), deleteExpense);

module.exports = router;