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
  getEmployeeExpenseSummary,
} = require('../../controllers/expenses');

const router = express.Router();

router.use(authenticate);
const canManageExpenses = authorize(['expenses.manage']);

// We'll use a specific 'expenses.manage' permission
router.post('/', canManageExpenses, createExpense);
router.get('/:id', canManageExpenses, getExpensesByEmployee);
router.get('/', canManageExpenses, getExpenses);
router.patch('/:id', canManageExpenses, updateExpense);
router.delete('/:id', canManageExpenses, deleteExpense);
// router.get("/",canManageExpenses,getEmployeeExpenseSummary)

module.exports = router;