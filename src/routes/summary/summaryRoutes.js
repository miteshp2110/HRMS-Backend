const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { getEmployeeExpenseSummary } = require('../../controllers/expenses');


const router = express.Router();

router.use(authenticate);
const canManageExpenses = authorize(['expenses.manage']);


router.get("/expenses",canManageExpenses,getEmployeeExpenseSummary)

module.exports = router;