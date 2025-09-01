const express = require('express');
const authenticate = require('../../middleware/authenticate');
const {
  createSkillRequest,
  getMySkillRequests,
  updateSkillRequest,
  deleteSkillRequest,
  getApprovalRequests,
  approveOrRejectRequest,
} = require('../../controllers/skillMatrix');

const router = express.Router();

// Apply authentication to all routes in this file
router.use(authenticate);

// --- Employee Routes (Self-Service) ---
router.post('/', createSkillRequest); // Employee creates a request for themselves
router.get('/my-requests', getMySkillRequests); // Employee gets their own requests
router.patch('/:requestId', updateSkillRequest); // Employee updates their own PENDING request
router.delete('/:requestId', deleteSkillRequest); // Employee deletes their own PENDING request

// --- Manager Routes (Approval Workflow) ---
router.get('/approvals', getApprovalRequests); // Manager gets requests for their direct reports
router.patch('/approvals/:requestId', approveOrRejectRequest); // Manager approves/rejects a request

module.exports = router;