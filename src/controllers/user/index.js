const { get } = require('../../routes/user/userRoutes');
const { createUser } = require('./create');
const { getMyProfile, getUserProfileById } = require('./profile');
const { getAllUsers, searchUsers, findUsersByPermissions, getDirectReports } = require('./read');
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
  updateSelfProfile
};