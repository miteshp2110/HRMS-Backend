const { createLoanType, getAllLoanTypes, updateLoanType } = require('./types');
const { checkEligibility, applyForLoan } = require('./application');
const { getLoanApprovals, processLoan, disburseLoan } = require('./approval');
const { getLoanApplications, getLoanApplicationById, getOngoingLoansByEmployee } = require('./read');
const { manualRepayment, forecloseLoan } = require('./repayment');
const { updateLoanApplicationByAdmin } = require('./admin');
const { downloadLoanApplicationPDF } = require('./download'); // New import

module.exports = {
  // Loan Type Management
  createLoanType,
  getAllLoanTypes,
  updateLoanType,

  // Application Process
  checkEligibility,
  applyForLoan,

  // Approval & Disbursement
  getLoanApprovals,
  processLoan,
  disburseLoan,

  // Read Operations
  getLoanApplications,
  getLoanApplicationById,
  getOngoingLoansByEmployee,
    
  // Repayment & Closure
  manualRepayment,
  forecloseLoan,
    
  // Admin Actions
  updateLoanApplicationByAdmin,

  // Download
  downloadLoanApplicationPDF
};