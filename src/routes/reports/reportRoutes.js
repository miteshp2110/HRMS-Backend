// routes/reports.js
const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

// Import report controllers
const attendanceReportsController = require('../../controllers/reports/attendanceReportsController');
const payrollReportsController = require('../../controllers/reports/payrollReportsController');
const leaveReportsController = require('../../controllers/reports/leaveReportsController');
const employeeReportsController = require('../../controllers/reports/employeeReportsController');
const performanceReportsController = require('../../controllers/reports/performanceReportsController');
const hrCaseReportsController = require('../../controllers/reports/hrCaseReportsController');

// Import utilities
const { validateReportParams, cleanupOldReports } = require('../../utils/reportHelpers');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Permission middleware
const canViewReports = authorize(['user.manage']);
const canViewPayrollReports = authorize(['user.manage']);
const canViewEmployeeReports = authorize(['user.manage']);
const canViewAttendanceReports = authorize(['user.manage']);
const canViewLeaveReports = authorize(['user.manage']);
const canViewPerformanceReports = authorize(['user.manage']);
const canViewHRCaseReports = authorize(['user.manage']);

// Validation middleware
const validateReportRequest = (req, res, next) => {
  const errors = validateReportParams(req.body);
  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }
  next();
};

// Cleanup middleware - run periodically
const cleanupMiddleware = (req, res, next) => {
  // Run cleanup every 100 requests (approximately)
  if (Math.random() < 0.01) {
    setImmediate(cleanupOldReports);
  }
  next();
};

router.use(cleanupMiddleware);

// =============================================================================
// ATTENDANCE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/attendance/detailed
 * @desc Generate detailed attendance report with filtering options
 * @access Private (requires attendance.view permission)
 * @body {
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   employeeIds?: number[],
 *   departments?: number[],
 *   format?: 'pdf' | 'excel',
 *   includeDetails?: boolean
 * }
 */
router.post('/attendance/detailed', 
  canViewAttendanceReports, 
  validateReportRequest, 
  attendanceReportsController.generateAttendanceReport
);

/**
 * @route POST /api/reports/attendance/monthly
 * @desc Generate monthly attendance summary report
 * @access Private (requires attendance.view permission)
 * @body {
 *   month: number (1-12),
 *   year: number,
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/attendance/monthly', 
  canViewAttendanceReports, 
  attendanceReportsController.generateMonthlyAttendanceSummary
);

/**
 * @route POST /api/reports/attendance/employee-summary
 * @desc Generate individual employee attendance summary
 * @access Private (requires attendance.view permission)
 * @body {
 *   employeeId: number,
 *   startDate: string,
 *   endDate: string,
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/attendance/employee-summary', 
  canViewAttendanceReports, 
  validateReportRequest,
  attendanceReportsController.generateEmployeeAttendanceSummary
);

// =============================================================================
// PAYROLL REPORTS
// =============================================================================

/**
 * @route POST /api/reports/payroll/cycle
 * @desc Generate comprehensive payroll report for a specific cycle
 * @access Private (requires payroll.view permission)
 * @body {
 *   cycleId: number,
 *   format?: 'pdf' | 'excel',
 *   includeBreakdown?: boolean
 * }
 */
router.post('/payroll/cycle', 
  canViewPayrollReports, 
  payrollReportsController.generatePayrollReport
);

/**
 * @route POST /api/reports/payroll/salary-structure
 * @desc Generate salary structure comparison report
 * @access Private (requires payroll.view permission)
 * @body {
 *   employeeIds?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/payroll/salary-structure', 
  canViewPayrollReports, 
  validateReportRequest,
  payrollReportsController.generateSalaryStructureReport
);

/**
 * @route POST /api/reports/payroll/cost-center
 * @desc Generate payroll cost center analysis
 * @access Private (requires payroll.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   departments?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/payroll/cost-center', 
  canViewPayrollReports, 
  validateReportRequest,
  payrollReportsController.generateCostCenterReport
);

// =============================================================================
// LEAVE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/leave/detailed
 * @desc Generate detailed leave report with applications and balances
 * @access Private (requires leave.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   employeeIds?: number[],
 *   leaveTypeIds?: number[],
 *   format?: 'pdf' | 'excel',
 *   includeBalances?: boolean
 * }
 */
router.post('/leave/detailed', 
  canViewLeaveReports, 
  validateReportRequest,
  leaveReportsController.generateLeaveReport
);

/**
 * @route POST /api/reports/leave/balances
 * @desc Generate leave balance utilization report
 * @access Private (requires leave.view permission)
 * @body {
 *   employeeIds?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/leave/balances', 
  canViewLeaveReports, 
  validateReportRequest,
  leaveReportsController.generateLeaveBalanceReport
);

/**
 * @route POST /api/reports/leave/encashment
 * @desc Generate leave encashment report
 * @access Private (requires leave.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   employeeIds?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/leave/encashment', 
  canViewLeaveReports, 
  validateReportRequest,
  leaveReportsController.generateLeaveEncashmentReport
);

// =============================================================================
// EMPLOYEE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/employee/directory
 * @desc Generate comprehensive employee directory report
 * @access Private (requires employees.view permission)
 * @body {
 *   departments?: number[],
 *   roles?: number[],
 *   includeInactive?: boolean,
 *   format?: 'pdf' | 'excel',
 *   includeContactInfo?: boolean,
 *   includeSalaryInfo?: boolean
 * }
 */
router.post('/employee/directory', 
  canViewEmployeeReports, 
  validateReportRequest,
  employeeReportsController.generateEmployeeDirectoryReport
);

/**
 * @route POST /api/reports/employee/demographics
 * @desc Generate employee demographics and analytics report
 * @access Private (requires employees.view permission)
 * @body {
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/employee/demographics', 
  canViewEmployeeReports, 
  employeeReportsController.generateEmployeeDemographicsReport
);

/**
 * @route POST /api/reports/employee/skill-matrix
 * @desc Generate employee skill matrix report
 * @access Private (requires employees.view permission)
 * @body {
 *   employeeIds?: number[],
 *   skillIds?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/employee/skill-matrix', 
  canViewEmployeeReports, 
  validateReportRequest,
  employeeReportsController.generateSkillMatrixReport
);

/**
 * @route POST /api/reports/employee/probation
 * @desc Generate probation status report
 * @access Private (requires employees.view permission)
 * @body {
 *   format?: 'pdf' | 'excel',
 *   includePastProbation?: boolean
 * }
 */
router.post('/employee/probation', 
  canViewEmployeeReports, 
  employeeReportsController.generateProbationReport
);

// =============================================================================
// PERFORMANCE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/performance/appraisals
 * @desc Generate comprehensive performance appraisal report
 * @access Private (requires performance.view permission)
 * @body {
 *   cycleId: number,
 *   employeeIds?: number[],
 *   format?: 'pdf' | 'excel',
 *   includeGoalDetails?: boolean,
 *   includeKPIDetails?: boolean
 * }
 */
router.post('/performance/appraisals', 
  canViewPerformanceReports, 
  performanceReportsController.generatePerformanceReport
);

/**
 * @route POST /api/reports/performance/cycles
 * @desc Generate performance cycle comparison report
 * @access Private (requires performance.view permission)
 * @body {
 *   cycleIds: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/performance/cycles', 
  canViewPerformanceReports, 
  performanceReportsController.generateCycleReport
);

/**
 * @route POST /api/reports/performance/goals
 * @desc Generate goals achievement report
 * @access Private (requires performance.view permission)
 * @body {
 *   cycleId: number,
 *   employeeIds?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/performance/goals', 
  canViewPerformanceReports, 
  performanceReportsController.generateGoalsReport
);

// =============================================================================
// HR CASE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/cases/detailed
 * @desc Generate comprehensive HR case report
 * @access Private (requires cases.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   employeeIds?: number[],
 *   categoryIds?: number[],
 *   status?: string[],
 *   format?: 'pdf' | 'excel',
 *   includeAttachments?: boolean
 * }
 */
router.post('/cases/detailed', 
  canViewHRCaseReports, 
  validateReportRequest,
  hrCaseReportsController.generateHRCaseReport
);

/**
 * @route POST /api/reports/cases/summary
 * @desc Generate HR case summary report with trends and analytics
 * @access Private (requires cases.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   format?: 'pdf' | 'excel',
 *   includeTrends?: boolean
 * }
 */
router.post('/cases/summary', 
  canViewHRCaseReports, 
  validateReportRequest,
  hrCaseReportsController.generateCaseSummaryReport
);

/**
 * @route POST /api/reports/cases/deduction-analysis
 * @desc Generate deduction analysis report for HR cases
 * @access Private (requires cases.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/cases/deduction-analysis', 
  canViewHRCaseReports, 
  validateReportRequest,
  hrCaseReportsController.generateDeductionAnalysisReport
);

// =============================================================================
// LOAN & ADVANCE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/loans/applications
 * @desc Generate loan applications report
 * @access Private (requires loans.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   employeeIds?: number[],
 *   loanTypeIds?: number[],
 *   status?: string[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/loans/applications', 
  canViewReports, 
  validateReportRequest,
  require('../../controllers/reports/loanReportsController').generateLoanApplicationsReport
);

/**
 * @route POST /api/reports/loans/repayments
 * @desc Generate loan repayments tracking report
 * @access Private (requires loans.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   employeeIds?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/loans/repayments', 
  canViewReports, 
  validateReportRequest,
  require('../../controllers/reports/loanReportsController').generateLoanRepaymentsReport
);

// =============================================================================
// EXPENSE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/expenses/claims
 * @desc Generate expense claims report
 * @access Private (requires expenses.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   employeeIds?: number[],
 *   categoryIds?: number[],
 *   status?: string[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/expenses/claims', 
  canViewReports, 
  validateReportRequest,
  require('../../controllers/reports/expenseReportsController').generateExpenseClaimsReport
);

// =============================================================================
// COMBINED REPORTS
// =============================================================================

/**
 * @route POST /api/reports/combined/employee-complete
 * @desc Generate complete employee report (attendance, leave, performance, cases)
 * @access Private (requires multiple permissions)
 * @body {
 *   employeeId: number,
 *   startDate: string,
 *   endDate: string,
 *   format?: 'pdf' | 'excel',
 *   includeAttendance?: boolean,
 *   includeLeave?: boolean,
 *   includePerformance?: boolean,
 *   includeCases?: boolean
 * }
 */
router.post('/combined/employee-complete', 
  canViewReports, 
  validateReportRequest,
  require('../../controllers/reports/combinedReportsController').generateCompleteEmployeeReport
);

/**
 * @route POST /api/reports/combined/executive-dashboard
 * @desc Generate executive dashboard report with key metrics
 * @access Private (requires admin permissions)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/combined/executive-dashboard', 
  authorize(['admin']), 
  validateReportRequest,
  require('../../controllers/reports/combinedReportsController').generateExecutiveDashboardReport
);

// =============================================================================
// AUDIT & COMPLIANCE REPORTS
// =============================================================================

/**
 * @route POST /api/reports/audit/user-changes
 * @desc Generate user audit trail report
 * @access Private (requires audit.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   userIds?: number[],
 *   changedBy?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/audit/user-changes', 
  authorize(['audit.view']), 
  validateReportRequest,
  require('../../controllers/reports/auditReportsController').generateUserAuditReport
);

/**
 * @route POST /api/reports/audit/attendance-changes
 * @desc Generate attendance audit trail report
 * @access Private (requires audit.view permission)
 * @body {
 *   startDate: string,
 *   endDate: string,
 *   employeeIds?: number[],
 *   format?: 'pdf' | 'excel'
 * }
 */
router.post('/audit/attendance-changes', 
  authorize(['audit.view']), 
  validateReportRequest,
  require('../../controllers/reports/auditReportsController').generateAttendanceAuditReport
);

// =============================================================================
// UTILITY ENDPOINTS
// =============================================================================

/**
 * @route GET /api/reports/available-reports
 * @desc Get list of available reports for the current user
 * @access Private
 */
router.get('/available-reports', (req, res) => {
  const userPermissions = req.user.permissions || [];
  
  const availableReports = [
    // Attendance Reports
    {
      category: 'Attendance',
      reports: [
        { 
          name: 'Detailed Attendance Report', 
          endpoint: '/attendance/detailed',
          permissions: ['attendance.view', 'reports.view'],
          description: 'Comprehensive attendance data with punch times and analysis'
        },
        { 
          name: 'Monthly Attendance Summary', 
          endpoint: '/attendance/monthly',
          permissions: ['attendance.view', 'reports.view'],
          description: 'Monthly summary of attendance patterns by employee'
        }
      ]
    },
    // Payroll Reports
    {
      category: 'Payroll',
      reports: [
        { 
          name: 'Payroll Cycle Report', 
          endpoint: '/payroll/cycle',
          permissions: ['payroll.view', 'reports.view'],
          description: 'Complete payroll processing report for a cycle'
        },
        { 
          name: 'Salary Structure Report', 
          endpoint: '/payroll/salary-structure',
          permissions: ['payroll.view', 'reports.view'],
          description: 'Employee salary structure comparison and analysis'
        }
      ]
    },
    // Employee Reports
    {
      category: 'Employees',
      reports: [
        { 
          name: 'Employee Directory', 
          endpoint: '/employee/directory',
          permissions: ['employees.view', 'reports.view'],
          description: 'Complete employee directory with contact information'
        },
        { 
          name: 'Demographics Report', 
          endpoint: '/employee/demographics',
          permissions: ['employees.view', 'reports.view'],
          description: 'Employee demographics and workforce analytics'
        }
      ]
    }
    // Add more categories as needed
  ];
  
  // Filter reports based on user permissions
  const filteredReports = availableReports.map(category => ({
    ...category,
    reports: category.reports.filter(report => 
      report.permissions.some(permission => userPermissions.includes(permission))
    )
  })).filter(category => category.reports.length > 0);
  
  res.json({
    success: true,
    availableReports: filteredReports,
    totalReports: filteredReports.reduce((total, category) => total + category.reports.length, 0)
  });
});

/**
 * @route POST /api/reports/schedule
 * @desc Schedule a report to be generated and emailed
 * @access Private
 * @body {
 *   reportType: string,
 *   reportConfig: object,
 *   schedule: string, // cron expression
 *   recipients: string[]
 * }
 */
router.post('/schedule', canViewReports, (req, res) => {
  // This would integrate with a job scheduler like node-cron or Bull Queue
  res.status(501).json({ 
    message: 'Report scheduling feature coming soon',
    supportedInFutureVersion: true 
  });
});

/**
 * @route GET /api/reports/cleanup
 * @desc Manually trigger cleanup of old report files
 * @access Private (Admin only)
 */
router.get('/cleanup', authorize(['admin']), (req, res) => {
  try {
    cleanupOldReports();
    res.json({ 
      success: true, 
      message: 'Cleanup completed successfully' 
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Cleanup failed' 
    });
  }
});

// Error handling middleware for reports
router.use((error, req, res, next) => {
  console.error('Reports route error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'Report data too large to process'
    });
  }
  
  if (error.message.includes('timeout')) {
    return res.status(408).json({
      message: 'Report generation timed out. Please try with a smaller date range.'
    });
  }
  
  res.status(500).json({
    message: 'An error occurred while generating the report',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;