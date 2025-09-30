const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  punchIn,
  punchOut,
  getMyAttendance,
  getAttendanceRecords,
  updatePayType,
  approveOvertime,
  requestOvertime,
  getMyOvertimeRecords,
  deleteOvertimeRequest,
  getOvertimeRequestsForApproval,
  approveOrRejectOvertime,
  updateOvertimeRecord,
  getEmployeeMonthlySummary,
  getAttendanceRecordById,
  getAttendanceAuditHistory,
  getOvertimeAuditHistory,
  getOvertimeRequestsForApprovalForId,
  bulkCreateAttendance,
  
} = require('../../controllers/attendance');

const router = express.Router();

router.use(authenticate)

// --- Employee Self-Service Routes ---

const canManageAttendance = authorize(['attendance.manage']);

router.get('/all',getAttendanceRecords) // managed
router.get('/me',getMyAttendance)
router.get('/:recordId', canManageAttendance, getAttendanceRecordById);
router.get('/summary/:employeeId/:year/:month', getEmployeeMonthlySummary); //managed
router.post('/punch-in',canManageAttendance, punchIn);
router.post('/punch-out',canManageAttendance, punchOut);
router.post("/bulk",canManageAttendance,bulkCreateAttendance)
// router.post('/update/pay-type/:recordId',canManageAttendance,updatePayType)

// router.post('/update/overtime/:recordId',canManageAttendance,approveOvertime)

router.post('/overtime/request', requestOvertime);
router.get('/overtime/my-records', getMyOvertimeRecords);
router.delete('/overtime/request/:overtimeId', deleteOvertimeRequest);

// Manager/Admin Routes
router.get('/overtime/approvals/:employeeId', canManageAttendance, getOvertimeRequestsForApprovalForId);
router.get('/overtime/approvals', canManageAttendance, getOvertimeRequestsForApproval);
router.patch('/overtime/process/:overtimeId', canManageAttendance, approveOrRejectOvertime);
router.patch('/overtime/edit/:overtimeId', canManageAttendance, updateOvertimeRecord);

router.get('/audit/attendance/:recordId',canManageAttendance,getAttendanceAuditHistory)
router.get('/audit/overtime/:overtimeRecordId',canManageAttendance,getOvertimeAuditHistory)
// router.get('/me', getMyAttendance);

// --- Admin & Manager Routes ---
// router.get('/employee/:employeeId', authorize(['attendance.view_all']), getAttendanceByEmployee);
// router.patch('/edit/:recordId', authorize(['attendance.edit']), editAttendanceRecord);

module.exports = router;