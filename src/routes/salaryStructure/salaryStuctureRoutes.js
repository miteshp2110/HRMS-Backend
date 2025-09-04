const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  assignOrUpdateComponent,
  getEmployeeSalaryStructure,
  removeComponent,
} = require('../../controllers/payroll/structure');

const router = express.Router();
router.use(authenticate);

// Use a permission like 'payroll.manage' for these administrative tasks
const canManagePayroll = authorize(['payroll.manage']);

// Get the full salary structure for an employee
router.get('/:employeeId', getEmployeeSalaryStructure);

// Assign or Update a single component for an employee
router.post('/:employeeId',  assignOrUpdateComponent);

// Remove a single component from an employee's structure
router.delete('/:employeeId/components/:componentId', removeComponent);

module.exports = router;