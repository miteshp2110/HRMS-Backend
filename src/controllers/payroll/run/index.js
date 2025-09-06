const { deletePayrollRun } = require('./delete');
const { getEditablePayslipDetails, updatePayslipComponent, removePayslipComponent, addPayslipComponent } = require('./edit');
const { getAllPayrolls, getPayslipsByPayrollId } = require('./read');
const { initiatePayrollRun, finalizePayrollRun } = require('./run');
// ... other imports

module.exports = {
  initiatePayrollRun,
  finalizePayrollRun,
  getAllPayrolls,
  deletePayrollRun,
  getEditablePayslipDetails,
  updatePayslipComponent,
  removePayslipComponent,
  getPayslipsByPayrollId,
  addPayslipComponent
  // ... other payroll controllers
};