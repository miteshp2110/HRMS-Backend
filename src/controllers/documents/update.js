const { pool } = require('../../db/connector');

/**
 * @description Update a required document's name.
 */
const updateDocument = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Name is required.' });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE required_documents SET name = ? WHERE id = ?',
      [name, id]
    );

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