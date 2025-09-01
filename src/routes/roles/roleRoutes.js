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
} = require('../../controllers/roles'); // Clean import from the index file

const router = express.Router();

router.use(authenticate);

router.post('/', authorize(['roles.assign']), createRole);
router.get('/', authorize(['roles.view']), getAllRoles);
router.get('/:id', authorize(['roles.view']), getRoleById);
router.patch('/:id', authorize(['roles.assign']), updateRole);
router.put('/:id/permissions', authorize(['roles.assign']), manageRolePermissions);
router.delete('/:id', authorize(['roles.assign']), deleteRole);

module.exports = router;