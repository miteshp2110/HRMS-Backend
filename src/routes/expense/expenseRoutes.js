const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware')
const {
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
  markAsReimbursed,
  setReimbursementDetails,
} = require('../../controllers/expenses');
const { getAllCategories, createCategory, updateCategory, deleteCategory } = require('../../controllers/expenses/categories');

const router = express.Router();

router.use(authenticate);
const canManageExpenses = authorize(['expenses.manage']);

// We'll use a specific 'expenses.manage' permission
// router.get("/",canManageExpenses,getEmployeeExpenseSummary)

router.get('/categories', getAllCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id',  updateCategory);
router.delete('/categories/:id',  deleteCategory);


// --- Expense Claim & Advance Routes ---
router.post('/claim', upload.single('receipt'), createExpenseClaim);
router.post('/advance',  createExpenseAdvance);
router.get('/claims', getExpenseClaims); // Gets own claims, or all if admin

router.get('/approvals',  getPendingExpenseApprovals);
router.patch('/process/:claimId',  processExpenseClaim);
router.patch('/reimburse/:claimId',  setReimbursementDetails);

router.post('/',  createExpense);
router.get('/:id',  getExpensesByEmployee);
router.get('/',  getExpenses);
router.patch('/:id',  updateExpense);
router.delete('/:id',  deleteExpense);
module.exports = router;