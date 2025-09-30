const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

const {
    createLoanType,
    getAllLoanTypes,
    updateLoanType,
    checkEligibility,
    applyForLoan,
    getLoanApprovals,
    processLoan,
    disburseLoan,
    getLoanApplications,
    getLoanApplicationById,
    manualRepayment,
    forecloseLoan,
    updateLoanApplicationByAdmin,
    getOngoingLoansByEmployee,
    downloadLoanApplicationPDF
} = require('../../controllers/loans');

const router = express.Router();

router.use(authenticate);
const canManageLoans = authorize(['loans.manage']);

// --- Loan Type Management Routes (Admin) ---
router.post('/types', canManageLoans, createLoanType);
router.get('/types', getAllLoanTypes);
router.patch('/types/:id', canManageLoans, updateLoanType);


// --- Employee Loan Application Routes ---
router.get('/eligibility', checkEligibility);
router.post('/apply', applyForLoan);


// --- Manager & HR Approval Workflow Routes ---
router.get('/approvals', canManageLoans, getLoanApprovals);
router.patch('/process/:applicationId', canManageLoans, processLoan);
router.post('/disburse/:applicationId', canManageLoans, disburseLoan);


// --- Read & Track Application Routes ---
router.get('/applications', getLoanApplications);
router.get('/applications/ongoing/:employeeId', getOngoingLoansByEmployee); // New Route
router.get('/applications/:applicationId', getLoanApplicationById);
router.get('/download/:applicationId', downloadLoanApplicationPDF);


// --- Repayment & Closure Routes (Admin) ---
router.post('/repayment/manual/:scheduleId', canManageLoans, manualRepayment);
router.post('/foreclose/:applicationId', canManageLoans, forecloseLoan);


// --- Admin-Specific Routes ---
router.patch('/admin/update/:applicationId', canManageLoans, updateLoanApplicationByAdmin);


module.exports = router;