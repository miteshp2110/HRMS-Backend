const { createExpense } = require('./create');
const { getExpenses, getExpenseById, getExpensesByEmployee } = require('./read');
const { updateExpense } = require('./update');
const { deleteExpense } = require('./delete');

module.exports = {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpenseById,
  getExpensesByEmployee
};