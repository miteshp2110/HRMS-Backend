const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  requestLoan,
  getMyLoans,
  getAllLoanRequests,
  approveOrRejectLoan,
  getApprovedLoans,
  getLoanRepaymentHistory,
  editLoan,
} = require('../../controllers/loans');

const router = express.Router();
router.use(authenticate);

// --- Employee Self-Service Routes ---
router.post('/', requestLoan);
router.get('/my-loans', getMyLoans);

// --- Admin & HR Routes ---
const canManageLoans = authorize(['loans.manage']); // A new permission for managing loans

router.get('/all', canManageLoans,getAllLoanRequests);
router.patch('/approve/:loanId', canManageLoans,approveOrRejectLoan);
router.get('/approved', canManageLoans,getApprovedLoans);
router.get('/repayments/:loanId',canManageLoans,getLoanRepaymentHistory)
router.patch('/edit/:loanId',canManageLoans,editLoan)

module.exports = router;