const { createExpense } = require('./create');
const { getExpenses, getExpenseById, getExpensesByEmployee, getEmployeeExpenseSummary } = require('./read');
const { updateExpense } = require('./update');
const { deleteExpense } = require('./delete');
const { createExpenseClaim, createExpenseAdvance, getExpenseClaims } = require('./claims');
const { markAsReimbursed, processExpenseClaim, getPendingExpenseApprovals, setReimbursementDetails } = require('./approval');

module.exports = {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getExpensesByEmployee,
  getEmployeeExpenseSummary,
  createExpenseClaim,
  createExpenseAdvance,
  getExpenseClaims,
  getPendingExpenseApprovals,
  processExpenseClaim,
  setReimbursementDetails
};