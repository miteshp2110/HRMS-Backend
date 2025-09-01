const { createRole } = require('./create');
const { getAllRoles, getRoleById } = require('./read');
const { updateRole } = require('./update');
const { deleteRole } = require('./delete');
const { manageRolePermissions } = require('./permissions');
const { getAllPermissions } = require('./getPermissions');

module.exports = {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  deleteRole,
  manageRolePermissions,
  getAllPermissions
};