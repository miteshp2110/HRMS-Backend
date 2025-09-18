const { pool } = require('../../db/connector');

/**
 * @description Update a required document's name and/or reminder threshold.
 */
const updateDocument = async (req, res) => {
  const { id } = req.params;
  const { name, reminder_threshold } = req.body;
  const updated_by = req.user.id; // Get the ID of the user making the change

  if (!name && reminder_threshold === undefined) {
    return res.status(400).json({ message: 'At least one field (name, reminder_threshold) is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Dynamically build the SET clause to only update the fields that are provided
    const fieldsToUpdate = [];
    const values = [];

    if (name) {
        fieldsToUpdate.push('name = ?');
        values.push(name);
    }
    if (reminder_threshold !== undefined) {
        fieldsToUpdate.push('reminder_threshold = ?');
        values.push(reminder_threshold);
    }

    fieldsToUpdate.push('updated_by = ?');
    values.push(updated_by);

    const sql = `UPDATE required_documents SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    values.push(id);

    const [result] = await connection.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    res.status(200).json({ success: true, message: 'Document updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A document with this name already exists.' });
    }
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateDocument };