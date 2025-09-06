const { get } = require('../../routes/user/userRoutes');
const { createUser } = require('./create');
const { getMyProfile, getUserProfileById } = require('./profile');
const { updateUser } = require('./update');

module.exports = {
  createUser,
  updateUser,
  getMyProfile,
  getUserProfileById
};