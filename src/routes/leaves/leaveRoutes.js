const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createLeaveType,
  getAllLeaveTypes,
  updateLeaveType,
  deleteLeaveType,
} = require('../../controllers/leaves');

const router = express.Router();

router.use(authenticate);

// We'll use a specific 'leaves.manage' permission for CUD actions
router.post('/types', authorize(['leaves.manage']), createLeaveType);
router.get('/types', getAllLeaveTypes); // Any authenticated user can view leave types
router.patch('/types/:id', authorize(['leaves.manage']), updateLeaveType);
router.delete('/types/:id', authorize(['leaves.manage']), deleteLeaveType);

module.exports = router;