const { requestLoan, getMyLoans, getLoansByEmployee } = require('./request');
const { getAllLoanRequests, approveOrRejectLoan, getApprovedLoans, getLoanRepaymentHistory } = require('./approval');
const { editLoan } = require('./edit');
const { addManualRepayment } = require('./repayment');

module.exports = {
  requestLoan,
  getMyLoans,
  getAllLoanRequests,
  approveOrRejectLoan,
  getApprovedLoans,
  getLoanRepaymentHistory,
  editLoan,
  getLoansByEmployee,
  addManualRepayment
};