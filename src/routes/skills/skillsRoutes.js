const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createSkill,
  getAllSkills,
  updateSkill,
  deleteSkill,
} = require('../../controllers/skills');

const router = express.Router();

router.use(authenticate);
const canManageSkills = authorize(['skills.manage']);

// We'll use a specific 'skills.manage' permission for CUD actions
router.post('/', canManageSkills, createSkill);
router.get('/', getAllSkills); // Any authenticated user can view skills
router.patch('/:id', canManageSkills, updateSkill);
router.delete('/:id', canManageSkills, deleteSkill);

module.exports = router;