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
  
} = require('../../controllers/attendance');

const router = express.Router();

router.use(authenticate)

// --- Employee Self-Service Routes ---

const canManageAttendance = authorize(['attendance.manage']);

router.post('/punch-in',canManageAttendance, punchIn);
router.post('/punch-out',canManageAttendance, punchOut);
router.get('/me',getMyAttendance)
router.get('/all',canManageAttendance,getAttendanceRecords)

router.post('/update/pay-type/:recordId',canManageAttendance,updatePayType)

router.post('/update/overtime/:recordId',canManageAttendance,approveOvertime)
// router.get('/me', getMyAttendance);

// --- Admin & Manager Routes ---
// router.get('/employee/:employeeId', authorize(['attendance.view_all']), getAttendanceByEmployee);
// router.patch('/edit/:recordId', authorize(['attendance.edit']), editAttendanceRecord);

module.exports = router;