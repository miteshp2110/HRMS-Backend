const { pool } = require('../../db/connector');

/**
 * @description Update a skill's details.
 */
const updateSkill = async (req, res) => {
  const { id } = req.params;
  const { skill_name, skill_description } = req.body;

  if (!skill_name && !skill_description) {
    return res.status(400).json({ message: 'At least one field to update is required.' });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    const [[existingSkill]] = await connection.query('SELECT * FROM skills WHERE id = ?', [id]);

    if (!existingSkill) {
      return res.status(404).json({ message: 'Skill not found.' });
    }

    const newSkillName = skill_name || existingSkill.skill_name;
    const newSkillDescription = skill_description || existingSkill.skill_description;

    await connection.query(
      'UPDATE skills SET skill_name = ?, skill_description = ? WHERE id = ?',
      [newSkillName, newSkillDescription, id]
    );

    res.status(200).json({ success: true, message: 'Skill updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'A skill with this name already exists.' });
    }
    console.error('Error updating skill:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateSkill };