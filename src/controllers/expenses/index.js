const { createExpense } = require('./create');
const { getExpenses, getExpenseById, getExpensesByEmployee, getEmployeeExpenseSummary } = require('./read');
const { updateExpense } = require('./update');
const { deleteExpense } = require('./delete');

module.exports = {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getExpensesByEmployee,
  getEmployeeExpenseSummary
};