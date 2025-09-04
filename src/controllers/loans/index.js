const { requestLoan, getMyLoans } = require('./request');
const { getAllLoanRequests, approveOrRejectLoan } = require('./approval');

module.exports = {
  requestLoan,
  getMyLoans,
  getAllLoanRequests,
  approveOrRejectLoan,
};