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
router.get("/records",getMyLeaveRequests)
router.post("/request-leave",createLeaveRequest)
router.delete("/request/:recordId",deleteMyLeaveRequest)

router.get("/primary-approval",canManageLeaves,getPrimaryApprovalRequests)
router.get("/secondry-approval",canManageLeaves,getSecondaryApprovalRequests)

router.post("/primary-approval/:recordId",canManageLeaves,setPrimaryApprovalStatus)
router.post("/secondry-approval/:recordId",canManageLeaves,setSecondaryApprovalStatus)

router.get('/balance/:employeeId',canManageLeaves,getLeaveBalancesByEmployee)
router.get('/records/:employeeId',canManageLeaves,getLeaveRecordsByEmployee)

module.exports = router;