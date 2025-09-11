const { createLeaveType, createLeaveRequest } = require('./create');
const { getAllLeaveTypes, getMyLeaveBalances, getMyLeaveRequests, getLeaveBalancesByEmployee, getLeaveRecordsByEmployee } = require('./read');
const { updateLeaveType } = require('./update');
const { deleteLeaveType, deleteMyLeaveRequest } = require('./delete');
const { getPrimaryApprovalRequests, getSecondaryApprovalRequests, setPrimaryApprovalStatus, setSecondaryApprovalStatus, getMyApprovalHistory } = require('./approval');

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
  getMyApprovalHistory
};