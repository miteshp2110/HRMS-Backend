
const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const groupsController = require('../../controllers/payroll/groupsController');
const cycleController = require('../../controllers/payroll/cycleController');
const auditController = require('../../controllers/payroll/auditController');
const payslipController = require('../../controllers/payroll/payslipController');

const router = express.Router();

router.use(authenticate);
const canManagePayroll = authorize(['payroll.manage']);

// --- Setup: Payroll Groups ---
router.post('/groups', canManagePayroll, groupsController.createGroup);
router.get('/groups', canManagePayroll, groupsController.getAllGroups);
router.get('/groups/:groupId', canManagePayroll, groupsController.getGroupById);
router.put('/groups/:groupId', canManagePayroll, groupsController.updateGroup);
router.delete('/groups/:groupId', canManagePayroll, groupsController.deleteGroup);

// --- Component Definitions (for frontend) ---
router.get('/components', canManagePayroll, groupsController.getPayrollComponents);

// --- Payroll Cycle Management ---
router.post('/cycles',  cycleController.createCycle);
router.get('/cycles',  cycleController.getAllCycles);
router.get('/cycles/:cycleId',  cycleController.getCycleById);
router.patch('/cycles/:cycleId/status',  cycleController.updateCycleStatus);
router.delete('/cycles/:cycleId',  cycleController.deleteCycle);

// --- Auditing ---
router.post('/cycles/:cycleId/audit',  auditController.runAudit);
router.get('/cycles/:cycleId/audit/flags',  auditController.getAuditFlags);
router.patch('/audit/flags/:flagId/resolve',  auditController.resolveFlag);
router.post('/cycles/:cycleId/verifyAudit',  auditController.verifyAudit);

// --- Payroll Run Execution (Fixed to use cycleController) ---
router.post('/cycles/:cycleId/groups/:groupId/execute',  cycleController.executeGroupRun);
router.patch('/cycles/paid', cycleController.markAsPaid);

// --- Payslip Management & Review ---
router.get('/payslips/cycle/:cycleId',  payslipController.getPayslipsForCycle);
router.get('/payslips/:payslipId/review',  payslipController.getPayslipForReview);
router.patch('/payslips/:payslipId/status',  payslipController.updatePayslipStatus);
router.post('/payslips/:payslipId/adjust',  payslipController.addManualAdjustment);
router.post('/cycles/:cycleId/bulk-add', payslipController.bulkAddComponents);

router.delete('/payslips/:payslipId/details/:payslipDetailId', payslipController.deletePayslipComponent);

// --- Employee Self-Service ---
router.get('/cycles/:cycleId/my-payslip', payslipController.getMyPayslip);
router.get('/cycles/:cycleId/employee-payslip/:employeeId', payslipController.getEmployeePayslip);

module.exports = router;