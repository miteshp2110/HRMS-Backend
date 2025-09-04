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

// We'll use a specific 'leaves.manage' permission for CUD actions
router.post('/types', authorize(['leaves.manage']), createLeaveType);
router.get('/types', getAllLeaveTypes); // Any authenticated user can view leave types
router.patch('/types/:id', authorize(['leaves.manage']), updateLeaveType);
router.delete('/types/:id', authorize(['leaves.manage']), deleteLeaveType);

router.get("/balance",getMyLeaveBalances)
router.get("/records",getMyLeaveRequests)
router.post("/request-leave",createLeaveRequest)
router.delete("/request/:recordId",deleteMyLeaveRequest)

router.get("/primary-approval",getPrimaryApprovalRequests)
router.get("/secondry-approval",getSecondaryApprovalRequests)

router.post("/approve-primary/:recordId",setPrimaryApprovalStatus)
router.post("/approve-secondry/:recordId",setSecondaryApprovalStatus)

router.get('/balance/:employeeId',getLeaveBalancesByEmployee)
router.get('/records/:employeeId',getLeaveRecordsByEmployee)

module.exports = router;