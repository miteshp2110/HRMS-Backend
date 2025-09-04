const { pool } = require('../../../db/connector');

/**
 * @description Updates a payroll component's details.
 */
const updateComponent = async (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;

  if (!name && !type) {
    return res.status(400).json({ message: 'At least one field (name, type) is required.' });
  }

  if (type && !['earning', 'deduction'].includes(type)) {
    return res.status(400).json({ message: "Type must be either 'earning' or 'deduction'." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [[existing]] = await connection.query('SELECT * FROM payroll_components WHERE id = ?', [id]);
    if (!existing) {
        return res.status(404).json({ message: 'Component not found.' });
    }

    const newName = name || existing.name;
    const newType = type || existing.type;

    const [result] = await connection.query(
      'UPDATE payroll_components SET name = ?, type = ? WHERE id = ?',
      [newName, newType, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Component not found.' });
    }

    res.status(200).json({ success: true, message: 'Payroll component updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A payroll component with this name already exists.' });
    }
    console.error('Error updating payroll component:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateComponent };