const { createSkill } = require('./create');
const { getAllSkills } = require('./read');
const { updateSkill } = require('./update');
const { deleteSkill } = require('./delete');

module.exports = {
  createSkill,
  getAllSkills,
  updateSkill,
  deleteSkill,
};