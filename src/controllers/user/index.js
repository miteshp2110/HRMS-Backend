const { get } = require('../../routes/user/userRoutes');
const { getUserAuditHistory } = require('./audit');
const { bulkUploadUsers } = require('./bulkUpload');
const { createUser } = require('./create');
const { deactivateUser } = require('./deactivate');
const { getMyProfile, getUserProfileById } = require('./profile');
const { getAllUsers, searchUsers, findUsersByPermissions, getDirectReports } = require('./read');
const { generateUserUploadTemplate } = require('./template');
const { updateUser, updateSelfProfile } = require('./update');

module.exports = {
  createUser,
  updateUser,
  getMyProfile,
  getUserProfileById,
  getAllUsers,
  searchUsers,
  findUsersByPermissions,
  getDirectReports,
  updateSelfProfile,
  deactivateUser,
  getUserAuditHistory,
  generateUserUploadTemplate,
  bulkUploadUsers
};