// const express = require('express');
// const authenticate = require('../../middleware/authenticate');
// const authorize = require('../../middleware/authorize');
// const upload = require('../../middleware/uploadMiddleware')
// const {
//   punchIn,
//   punchOut,
//   getMyAttendance,
//   getAttendanceRecords,
//   updatePayType,
//   approveOvertime,
//   requestOvertime,
//   getMyOvertimeRecords,
//   deleteOvertimeRequest,
//   getOvertimeRequestsForApproval,
//   approveOrRejectOvertime,
//   updateOvertimeRecord,
//   getEmployeeMonthlySummary,
//   getAttendanceRecordById,
//   getAttendanceAuditHistory,
//   getOvertimeAuditHistory,
//   getOvertimeRequestsForApprovalForId,
//   bulkCreateAttendance,
//   bulkUploadAttendanceExcel,
  
// } = require('../../controllers/attendance');
// const { updateAttendanceRecord } = require('../../controllers/attendance/update');

// const router = express.Router();

// router.use(authenticate)

// // --- Employee Self-Service Routes ---

// const canManageAttendance = authorize(['attendance.manage']);

// router.get('/all',getAttendanceRecords) // managed
// router.get('/me',getMyAttendance)
// router.get('/:recordId', canManageAttendance, getAttendanceRecordById);
// router.patch('/:recordId', canManageAttendance, updateAttendanceRecord);
// router.get('/summary/:employeeId/:year/:month', getEmployeeMonthlySummary); //managed
// router.post('/punch-in',canManageAttendance, punchIn);
// router.post('/punch-out',canManageAttendance, punchOut);
// router.post("/bulk",canManageAttendance,bulkCreateAttendance)

// router.post("/bulk-upload-excel", canManageAttendance, upload.single('file'), bulkUploadAttendanceExcel);
// // router.post('/update/pay-type/:recordId',canManageAttendance,updatePayType)

// // router.post('/update/overtime/:recordId',canManageAttendance,approveOvertime)

// router.post('/overtime/request', requestOvertime);
// router.get('/overtime/my-records', getMyOvertimeRecords);
// router.delete('/overtime/request/:overtimeId', deleteOvertimeRequest);

// // Manager/Admin Routes
// router.get('/overtime/approvals/:employeeId', canManageAttendance, getOvertimeRequestsForApprovalForId);
// router.get('/overtime/approvals', canManageAttendance, getOvertimeRequestsForApproval);
// router.patch('/overtime/process/:overtimeId', canManageAttendance, approveOrRejectOvertime);
// router.patch('/overtime/edit/:overtimeId', canManageAttendance, updateOvertimeRecord);

// router.get('/audit/attendance/:recordId',canManageAttendance,getAttendanceAuditHistory)
// router.get('/audit/overtime/:overtimeRecordId',canManageAttendance,getOvertimeAuditHistory)


// module.exports = router;


const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware')
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
  bulkUploadAttendanceExcel,
  
} = require('../../controllers/attendance');
const { updateAttendanceRecord } = require('../../controllers/attendance/update');

const router = express.Router();

router.use(authenticate)

// --- Employee Self-Service Routes ---

const canManageAttendance = authorize(['attendance.manage']);

router.get('/all',getAttendanceRecords) // managed
router.get('/me',getMyAttendance)
router.get('/:recordId', getAttendanceRecordById);
router.patch('/:recordId', updateAttendanceRecord);
router.get('/summary/:employeeId/:year/:month', getEmployeeMonthlySummary); //managed
router.post('/punch-in', punchIn);
router.post('/punch-out', punchOut);
router.post("/bulk",bulkCreateAttendance)

router.post("/bulk-upload-excel", upload.single('file'), bulkUploadAttendanceExcel);
// router.post('/update/pay-type/:recordId',canManageAttendance,updatePayType)

// router.post('/update/overtime/:recordId',canManageAttendance,approveOvertime)

router.post('/overtime/request', requestOvertime);
router.get('/overtime/my-records', getMyOvertimeRecords);
router.delete('/overtime/request/:overtimeId', deleteOvertimeRequest);

// Manager/Admin Routes
router.get('/overtime/approvals/:employeeId', getOvertimeRequestsForApprovalForId);
router.get('/overtime/approvals', getOvertimeRequestsForApproval);
router.patch('/overtime/process/:overtimeId', approveOrRejectOvertime);
router.patch('/overtime/edit/:overtimeId', updateOvertimeRecord);

router.get('/audit/attendance/:recordId',getAttendanceAuditHistory)
router.get('/audit/overtime/:overtimeRecordId',getOvertimeAuditHistory)


module.exports = router;