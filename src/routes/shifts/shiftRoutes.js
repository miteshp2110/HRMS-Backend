const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createShift,
  getAllShifts,
  updateShift,
  deleteShift,
  rotateIndividualShifts,
  getActiveUsersByShift,
  getUsersWithUnmarkedAttendance,
  getMyShiftDetails,
} = require('../../controllers/shifts');

const router = express.Router();

router.use(authenticate);
const canManageShifts = authorize(['shift.manage'])

router.get('/my', getMyShiftDetails);

// We'll use the 'manage_shifts' permission for CUD actions
router.get('/:shiftId/unmarked-attendance/:date',getUsersWithUnmarkedAttendance)
router.get('/:shiftId/users',getActiveUsersByShift)
router.post("/rotate/batch",rotateIndividualShifts)
router.post('/', canManageShifts, createShift);
router.get('/', canManageShifts, getAllShifts);
router.patch('/:id', canManageShifts, updateShift);
router.delete('/:id', canManageShifts, deleteShift);

module.exports = router;