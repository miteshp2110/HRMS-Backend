const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createComponent,
  getAllComponents,
  updateComponent,
  deleteComponent,
} = require('../../controllers/payroll/components');

const router = express.Router();
const canManagePayroll = authorize(['payroll.manage']);
router.use(authenticate);
router.use(canManagePayroll);

// We'll use a specific 'payroll.manage' permission

router.post('/', createComponent);
router.get('/', getAllComponents);
router.patch('/:id', updateComponent);
router.delete('/:id', deleteComponent);

module.exports = router;