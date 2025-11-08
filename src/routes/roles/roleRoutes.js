const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createRole,
  getAllRoles,
  getRoleById,
  updateRole,
  manageRolePermissions,
  deleteRole,
  getEmployeesByRole,
} = require('../../controllers/roles'); // Clean import from the index file

const router = express.Router();
const canManageRoles = authorize(['roles.manage']);

router.use(authenticate);
// router.use(canManageRoles);

router.get("/:roleId/employees",getEmployeesByRole)
router.put('/:id/permissions',  manageRolePermissions);
router.post('/',  createRole);
router.get('/',  getAllRoles);
router.get('/:id',  getRoleById);
router.patch('/:id',  updateRole);
router.delete('/:id',  deleteRole);

module.exports = router;