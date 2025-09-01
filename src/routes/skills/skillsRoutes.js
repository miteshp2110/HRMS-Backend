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

// We'll use a specific 'skills.manage' permission for CUD actions
router.post('/', authorize(['skills.manage']), createSkill);
router.get('/', getAllSkills); // Any authenticated user can view skills
router.patch('/:id', authorize(['skills.manage']), updateSkill);
router.delete('/:id', authorize(['skills.manage']), deleteSkill);

module.exports = router;