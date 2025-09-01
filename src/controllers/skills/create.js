const { pool } = require('../../db/connector');

/**
 * @description Create a new skill.
 */
const createSkill = async (req, res) => {
  const { skill_name, skill_description } = req.body;

  if (!skill_name || !skill_description) {
    return res.status(400).json({ message: 'skill_name and skill_description are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO skills (skill_name, skill_description) VALUES (?, ?)',
      [skill_name, skill_description]
    );
    res.status(201).json({
      success: true,
      message: 'Skill created successfully.',
      skill: { id: result.insertId, skill_name, skill_description },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A skill with this name already exists.' });
    }
    console.error('Error creating skill:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createSkill };