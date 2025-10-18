const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
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
  getLeaveLedgerByEmployee,
  requestLeaveEncashment,
  getEncashmentRequests,
  processEncashmentRequest,
  disburseEncashment,
  approveOrRejectEncashment,
  getAllEncashmentRecords,
  getMyEncashableLeaveBalances,
} = require('../../controllers/leaves');

const router = express.Router();

router.use(authenticate);
const canManageLeaves = authorize(['leaves.manage']);

// We'll use a specific 'leaves.manage' permission for CUD actions
router.post('/types', canManageLeaves, createLeaveType);
router.get('/types', getAllLeaveTypes); // Any authenticated user can view leave types
router.patch('/types/:id', canManageLeaves, updateLeaveType);
router.delete('/types/:id', canManageLeaves, deleteLeaveType);

router.get("/balance",getMyLeaveBalances)
router.get("/encashable-balance",getMyEncashableLeaveBalances)
router.get("/records",getMyLeaveRequests)
router.post("/request-leave",createLeaveRequest)
router.delete("/request/:recordId",deleteMyLeaveRequest)

router.get("/primary-approval",canManageLeaves,getPrimaryApprovalRequests)
router.get("/secondry-approval",canManageLeaves,getSecondaryApprovalRequests)

router.post("/primary-approval/:recordId",canManageLeaves,setPrimaryApprovalStatus)
router.post("/secondry-approval/:recordId",canManageLeaves,setSecondaryApprovalStatus)

router.get('/balance/:employeeId',canManageLeaves,getLeaveBalancesByEmployee)
router.get('/records/:employeeId',canManageLeaves,getLeaveRecordsByEmployee)
router.get('/history',getMyApprovalHistory)

router.get('/:id',getLeaveRecordById)
router.get('/download/:id',downloadLeaveApplication)
router.get('/ledger/:employeeId',canManageLeaves,getLeaveLedgerByEmployee)

router.post('/encashment/request', requestLeaveEncashment); // Employee submits a request
router.get('/encashment/all', canManageLeaves, getAllEncashmentRecords); // Admin gets all records
router.patch('/encashment/approval/:id', canManageLeaves, approveOrRejectEncashment); // Manager approves/rejects
router.patch('/encashment/disburse/:id', canManageLeaves, disburseEncashment); // HR disburses

module.exports = router;