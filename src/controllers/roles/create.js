const { pool } = require('../../db/connector');

/**
 * @description Create a new role.
 */
const createRole = async (req, res) => {
  const { name, role_level } = req.body || {};

  if (!name || role_level === undefined) {
    return res.status(400).json({ message: 'Role name and role_level are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [existing] = await connection.query('SELECT id FROM roles WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'A role with this name already exists.' });
    }

    const [result] = await connection.query('INSERT INTO roles (name, role_level) VALUES (?, ?)', [name, role_level]);
    res.status(201).json({
      success: true,
      message: 'Role created successfully.',
      role: { id: result.insertId, name, role_level },
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createRole };