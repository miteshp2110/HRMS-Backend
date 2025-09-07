const { requestLoan, getMyLoans, getLoansByEmployee } = require('./request');
const { getAllLoanRequests, approveOrRejectLoan, getApprovedLoans, getLoanRepaymentHistory } = require('./approval');
const { editLoan } = require('./edit');

module.exports = {
  requestLoan,
  getMyLoans,
  getAllLoanRequests,
  approveOrRejectLoan,
  getApprovedLoans,
  getLoanRepaymentHistory,
  editLoan,
  getLoansByEmployee
};