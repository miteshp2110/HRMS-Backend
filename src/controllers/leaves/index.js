const { createLeaveType, createLeaveRequest } = require('./create');
const { getAllLeaveTypes, getMyLeaveBalances, getMyLeaveRequests, getLeaveBalancesByEmployee, getLeaveRecordsByEmployee, getLeaveRecordById, getLeaveLedgerByEmployee } = require('./read');
const { updateLeaveType } = require('./update');
const { deleteLeaveType, deleteMyLeaveRequest } = require('./delete');
const { getPrimaryApprovalRequests, getSecondaryApprovalRequests, setPrimaryApprovalStatus, setSecondaryApprovalStatus, getMyApprovalHistory } = require('./approval');
const { downloadLeaveApplication } = require('./download');

module.exports = {
  createLeaveType,
  getAllLeaveTypes,
  updateLeaveType,
  deleteLeaveType,
  getMyLeaveBalances,
  getMyLeaveRequests,
  createLeaveRequest,
  deleteMyLeaveRequest,
  getPrimaryApprovalRequests,
  getSecondaryApprovalRequests,
  setPrimaryApprovalStatus,
  setSecondaryApprovalStatus,
  getLeaveBalancesByEmployee,
  getLeaveRecordsByEmployee,
  getMyApprovalHistory,
  getLeaveRecordById,
  downloadLeaveApplication,
  getLeaveLedgerByEmployee
};