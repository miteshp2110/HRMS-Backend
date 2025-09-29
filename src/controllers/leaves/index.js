const { createLeaveType, createLeaveRequest } = require('./create');
const { getAllLeaveTypes, getMyLeaveBalances, getMyLeaveRequests, getLeaveBalancesByEmployee, getLeaveRecordsByEmployee, getLeaveRecordById, getLeaveLedgerByEmployee } = require('./read');
const { updateLeaveType } = require('./update');
const { deleteLeaveType, deleteMyLeaveRequest } = require('./delete');
const { getPrimaryApprovalRequests, getSecondaryApprovalRequests, setPrimaryApprovalStatus, setSecondaryApprovalStatus, getMyApprovalHistory } = require('./approval');
const { downloadLeaveApplication } = require('./download');
const { requestLeaveEncashment, getEncashmentRequests, processEncashmentRequest, getAllEncashmentRecords, approveOrRejectEncashment, disburseEncashment } = require('./encashment'); // New

module.exports = {
  createLeaveType,
  createLeaveRequest,
  getAllLeaveTypes,
  getMyLeaveBalances,
  getMyLeaveRequests,
  getLeaveBalancesByEmployee,
  getLeaveRecordsByEmployee,
  getLeaveRecordById,
  getLeaveLedgerByEmployee,
  updateLeaveType,
  deleteLeaveType,
  deleteMyLeaveRequest,
  getPrimaryApprovalRequests,
  getSecondaryApprovalRequests,
  setPrimaryApprovalStatus,
  setSecondaryApprovalStatus,
  getMyApprovalHistory,
  downloadLeaveApplication,
  requestLeaveEncashment, // New
  getAllEncashmentRecords,
  approveOrRejectEncashment,
  disburseEncashment
};