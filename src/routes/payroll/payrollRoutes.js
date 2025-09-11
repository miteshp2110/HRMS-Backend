const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  initiatePayrollRun,
  finalizePayrollRun,
  deletePayrollRun,
  getAllPayrolls,
  getEditablePayslipDetails,
  updatePayslipComponent,
  removePayslipComponent,
  getPayslipsByPayrollId,
  addPayslipComponent
} = require('../../controllers/payroll/run');

const router = express.Router();
router.use(authenticate);
const canManagePayroll = authorize(['payroll.manage']);

// Initiates the run and puts it in a 'processing' state for review
router.post('/runs/initiate',  canManagePayroll,initiatePayrollRun);

// Marks the run as 'paid' and updates loan statuses
router.patch('/run/finalize/:payrollId',  canManagePayroll,finalizePayrollRun);

router.delete('/run/:payrollId',canManagePayroll,deletePayrollRun)
router.get('/runs',canManagePayroll,getAllPayrolls)

// payslips

router.get('/payslip/:payslipId/edit',canManagePayroll,getEditablePayslipDetails)
router.get('/payslip/:payrollId',canManagePayroll,getPayslipsByPayrollId)
router.put('/payslip/:payslipId/details/:detailId',canManagePayroll,updatePayslipComponent)
router.delete('/payslip/:payslipId/details/:detailId',canManagePayroll,removePayslipComponent)
router.post('/payslip/:payslipId/details',canManagePayroll,addPayslipComponent)
module.exports = router;