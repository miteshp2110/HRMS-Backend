// src/routes/reportsRoutes.js

const express = require('express');
const router = express.Router();

// Import all report controllers
const { generateEmployeeMasterReport } = require('../../controllers/reports/employeeMasterReport');
const { generateInactiveProbationReport } = require('../../controllers/reports/inactiveProbationReport');
const { generateDailyAttendanceReport } = require('../../controllers/reports/dailyAttendanceReport');
const { generateLateEarlyReport } = require('../../controllers/reports/lateEarlyReport');
const { generateOvertimeReport } = require('../../controllers/reports/overtimeReport');
const { generateLeaveBalanceReport } = require('../../controllers/reports/leaveBalanceReport');
const { generateLeaveApplicationsReport } = require('../../controllers/reports/leaveApplicationsReport');
const { generateLeaveEncashmentReport } = require('../../controllers/reports/leaveEncashmentReport');
const { generateLeaveLedgerReport } = require('../../controllers/reports/leaveLedgerReport');
const { generateLoanAmortizationReport } = require('../../controllers/reports/loanAmortizationReport');
const { generateExpenseClaimReport } = require('../../controllers/reports/expenseClaimReport');
const { generateAppraisalSummaryReport } = require('../../controllers/reports/appraisalSummaryReport');
const { generateGoalKpiReport } = require('../../controllers/reports/goalKpiReport');
const { generateJobApplicationsReport } = require('../../controllers/reports/jobApplicationsReport');
const { generateHrCasesReport } = require('../../controllers/reports/hrCasesReport');
const { generateShiftConfigurationReport } = require('../../controllers/reports/shiftConfigurationReport');
const { generateWorkWeekConfigurationReport } = require('../../controllers/reports/workWeekConfigurationReport');

// Employee Reports
router.post('/employee-master', generateEmployeeMasterReport);
router.post('/inactive-probation', generateInactiveProbationReport);

// Attendance Reports
router.post('/daily-attendance', generateDailyAttendanceReport);
router.post('/late-early', generateLateEarlyReport);
router.post('/overtime', generateOvertimeReport);

// Leave Reports
router.post('/leave-balance', generateLeaveBalanceReport);
router.post('/leave-applications', generateLeaveApplicationsReport);
router.post('/leave-encashment', generateLeaveEncashmentReport);
router.post('/leave-ledger', generateLeaveLedgerReport);

// Financial Reports
router.post('/loan-amortization', generateLoanAmortizationReport);
router.post('/expense-claims', generateExpenseClaimReport);

// Performance Reports
router.post('/appraisal-summary', generateAppraisalSummaryReport);
router.post('/goal-kpi', generateGoalKpiReport);

// Recruitment Reports
router.post('/job-applications', generateJobApplicationsReport);

// HR Management Reports
router.post('/hr-cases', generateHrCasesReport);

// Configuration Reports
router.post('/shift-configuration', generateShiftConfigurationReport);
router.post('/work-week-configuration', generateWorkWeekConfigurationReport);

module.exports = router;
