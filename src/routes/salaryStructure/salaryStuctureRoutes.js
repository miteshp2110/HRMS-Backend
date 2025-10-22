const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  assignOrUpdateComponent,
  getEmployeeSalaryStructure,
  removeComponent,
  getMySalaryStructure,
  editEmployeeComponent,
  getStandardParameters,
} = require('../../controllers/payroll/structure');
const { getSalaryStructureAuditHistory } = require('../../controllers/payroll/salaryAuditController');
const { scheduleRevision, getRevisionsByEmployee, cancelRevision, getMySalaryRevisions, updateScheduledRevision } = require('../../controllers/payroll/revisionsController');

const router = express.Router();
router.use(authenticate);


// Use a permission like 'payroll.manage' for these administrative tasks
const canManagePayroll = authorize(['payroll.manage']);

router.get('/params',getStandardParameters)
// Get the full salary structure for an employee
router.get('/:employeeId', canManagePayroll,getEmployeeSalaryStructure);

// Assign or Update a single component for an employee
router.post('/:employeeId',  canManagePayroll,assignOrUpdateComponent);

// Remove a single component from an employee's structure
router.delete('/:employeeId/components/:componentId',canManagePayroll, removeComponent);
router.patch('/:employeeId/components/:componentId', canManagePayroll, editEmployeeComponent);

router.get('/',getMySalaryStructure)
router.get('/revisions/me', getMySalaryRevisions);


router.get('/audit/:employeeId', canManagePayroll, getSalaryStructureAuditHistory);

// Schedule a new salary revision
router.post('/revisions/schedule', canManagePayroll, scheduleRevision);

// Get all revisions for an employee
router.get('/revisions/:employeeId', canManagePayroll, getRevisionsByEmployee);

// Cancel a scheduled revision
router.patch('/revisions/cancel/:revisionId', canManagePayroll, cancelRevision);

router.patch('/revisions/scheduled/:revisionId', canManagePayroll, updateScheduledRevision);


module.exports = router;