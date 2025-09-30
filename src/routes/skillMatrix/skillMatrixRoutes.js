const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createSkillRequest,
  getMySkillRequests,
  updateSkillRequest,
  deleteSkillRequest,
  getApprovalRequests,
  approveOrRejectRequest,
  getEmployeeSkills,
  getVerifiedEmployeesBySkill,
  getSkillMatrixSummary,
} = require('../../controllers/skillMatrix');

const router = express.Router();

// Apply authentication to all routes in this file
router.use(authenticate);
const canManageSkills = authorize(['skills.manage'])

// --- Employee Routes (Self-Service) ---
router.post('/', createSkillRequest); // Employee creates a request for themselves
router.get('/my-requests', getMySkillRequests); // Employee gets their own requests
router.patch('/:requestId', updateSkillRequest); // Employee updates their own PENDING request
router.delete('/:requestId', deleteSkillRequest); // Employee deletes their own PENDING request

router.get('/matrix',canManageSkills,getSkillMatrixSummary)

router.get('/skills/:skillName/employees',canManageSkills,getVerifiedEmployeesBySkill)
// --- Manager Routes (Approval Workflow) ---
router.get('/approvals', canManageSkills,getApprovalRequests); // Manager gets requests for their direct reports
router.patch('/approvals/:requestId', canManageSkills,approveOrRejectRequest); // Manager approves/rejects a request

router.get('/employee/:employeeId',canManageSkills,getEmployeeSkills)

module.exports = router;