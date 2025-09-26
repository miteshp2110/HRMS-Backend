const { createExpense } = require('./create');
const { getExpenses, getExpenseById, getExpensesByEmployee, getEmployeeExpenseSummary, getProcessedClaims, getUpcomingPayrollReimbursements } = require('./read');
const { updateExpense } = require('./update');
const { deleteExpense } = require('./delete');
const { createExpenseClaim, createExpenseAdvance, getExpenseClaims, updateExpenseClaim, deleteExpenseClaim, reimburseAdvance } = require('./claims');
const { markAsReimbursed, processExpenseClaim, getPendingExpenseApprovals, setReimbursementDetails } = require('./approval');
const { updateExpenseClaimByAdmin } = require('./admin');

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
  setReimbursementDetails,
  updateExpenseClaim,
  deleteExpenseClaim,
  updateExpenseClaimByAdmin,
  reimburseAdvance,
  getProcessedClaims,
  getUpcomingPayrollReimbursements
};