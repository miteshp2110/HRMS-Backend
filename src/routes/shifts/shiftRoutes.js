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

// We'll use the 'manage_shifts' permission for CUD actions
router.post('/', authorize(['shifts.create']), createShift);
router.get('/', authorize(['user.create']), getAllShifts);
router.patch('/:id', authorize(['shifts.create']), updateShift);
router.delete('/:id', authorize(['shifts.delete']), deleteShift);

module.exports = router;