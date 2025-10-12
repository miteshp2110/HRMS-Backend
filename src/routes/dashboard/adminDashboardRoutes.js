const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const adminDashboardController = require('../../controllers/dashboard/adminDashboardController');

const router = express.Router();

// Protect all dashboard routes with authentication
router.use(authenticate);

// Optional: You can add a specific permission for viewing the admin dashboard
// const canViewAdminDashboard = authorize(['dashboard.admin']);
// router.use(canViewAdminDashboard);


// 1. Today's Attendance Stats
router.get('/attendance-stats', adminDashboardController.getTodayAttendanceStats);

// 2. Pending Leave Approvals
router.get('/pending-leave-approvals', adminDashboardController.getPendingLeaveApprovals);

// 3. Pending Loan Approvals
router.get('/pending-loan-approvals', adminDashboardController.getPendingLoanApprovals);

// 4. Pending Skill Approvals
router.get('/pending-skill-approvals', adminDashboardController.getPendingSkillApprovals);

// 5. Pending Expense Approvals
router.get('/pending-expense-approvals', adminDashboardController.getPendingExpenseApprovals);

// 6. Pending Overtime Requests
router.get('/pending-overtime-requests', adminDashboardController.getPendingOvertimeRequests);

// 7. Upcoming Document Expiries (e.g., /document-expiries?days=60)
router.get('/document-expiries', adminDashboardController.getUpcomingDocumentExpiries);

// 8. Open HR Cases on Direct Reports
router.get('/open-cases-direct-reports', adminDashboardController.getOpenCasesOnDirectReports);

// 9. Expense Disbursement Requests
router.get('/expense-disbursement-requests', authorize(['expenses.manage']), adminDashboardController.getExpenseDisbursementRequests);

// 10. Loan Disbursement Requests
router.get('/loan-disbursement-requests', authorize(['loans.manage']), adminDashboardController.getLoanDisbursementRequests);

// 11. Leave Encashment Requests
router.get('/pending-leave-encashment', authorize(['leaves.manage']), adminDashboardController.getPendingLeaveEncashmentRequests);


module.exports = router;