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

module.exports = router;