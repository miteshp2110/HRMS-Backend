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

module.exports = {
  createSkillRequest,
  getMySkillRequests,
  updateSkillRequest,
  deleteSkillRequest,
  getApprovalRequests,
  approveOrRejectRequest,
};