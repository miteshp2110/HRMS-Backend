const {
  createSkillRequest,
  getMySkillRequests,
  updateSkillRequest,
  deleteSkillRequest,
} = require('./request');
const {
  getApprovalRequests,
  approveOrRejectRequest,
} = require('./approval');
const { getEmployeeSkills, getVerifiedEmployeesBySkill } = require('./read');
const { getSkillMatrixSummary } = require('./summary');

module.exports = {
  createSkillRequest,
  getMySkillRequests,
  updateSkillRequest,
  deleteSkillRequest,
  getApprovalRequests,
  approveOrRejectRequest,
  getEmployeeSkills,
  getVerifiedEmployeesBySkill,
  getSkillMatrixSummary
};