const { pool } = require('../../db/connector');

/**
 * @description Permanently deletes a required document type.
 */
const deleteDocument = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Check if this document type has been uploaded by any user
    const [uploads] = await connection.query(
      'SELECT id FROM uploaded_document WHERE document_id = ? LIMIT 1',
      [id]
    );
    if (uploads.length > 0) {
      return res.status(409).json({ message: 'Cannot delete document type. It has been uploaded by one or more users.' });
    }
    
    // 2. If not in use, proceed with deletion
    const [result] = await connection.query(
      'DELETE FROM required_documents WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};



/**
 * @description Deletes an uploaded document record.
 * Admins can delete any record; employees can only delete their own.
 */
const deleteUploadedDocument = async (req, res) => {
  const { documentId } = req.params;
  const requester = req.user;
  let connection;

  try {
    connection = await pool.getConnection();
    
    let sql = 'DELETE FROM uploaded_document WHERE id = ?';
    const params = [documentId];

    // If the user is not an admin, add a condition to ensure they can only delete their own document
    if (!requester.permissions.includes('documents.manage')) {
      sql += ' AND user_id = ?';
      params.push(requester.id);
    }
    
    const [result] = await connection.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Document not found or you do not have permission to delete it.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting uploaded document:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteDocument , deleteUploadedDocument};