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
router.post('/punch-in', punchIn);
router.post('/punch-out', punchOut);
router.get('/me',getMyAttendance)
router.get('/all',getAttendanceRecords)

router.post('/update/pay-type/:recordId',updatePayType)

router.post('/update/overtime/:recordId',approveOvertime)
// router.get('/me', getMyAttendance);

// --- Admin & Manager Routes ---
// router.get('/employee/:employeeId', authorize(['attendance.view_all']), getAttendanceByEmployee);
// router.patch('/edit/:recordId', authorize(['attendance.edit']), editAttendanceRecord);

module.exports = router;