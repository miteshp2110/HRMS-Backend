const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createShift,
  getAllShifts,
  updateShift,
  deleteShift,
} = require('../../controllers/shifts');

const router = express.Router();

router.use(authenticate);
const canManageShifts = authorize(['shift.manage'])

// We'll use the 'manage_shifts' permission for CUD actions
router.post('/', canManageShifts, createShift);
router.get('/', canManageShifts, getAllShifts);
router.patch('/:id', canManageShifts, updateShift);
router.delete('/:id', canManageShifts, deleteShift);

module.exports = router;