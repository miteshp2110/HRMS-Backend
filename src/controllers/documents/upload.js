const { pool } = require('../../db/connector');
const { uploadDocumentTOS3:uploadDocumentToS3 } = require('../../services/s3Service');

/**
 * @description Uploads a document. Handles both admin-for-employee and self-service uploads.
 */
const uploadDocument = async (req, res) => {
  const { document_id, expiry_date } = req.body || {};
  const requester = req.user;
  
  // Determine the target user ID. If an admin is uploading for someone,
  // the ID comes from the URL params. For self-service, it's from the token.
  const targetEmployeeId = req.params.employeeId || requester.id;

  if (!req.file || !document_id) {
    return res.status(400).json({ message: 'A file and document_id are required.' });
  }

  let connection;
  try {
    // 1. Upload the document to S3
    const documentUrl = await uploadDocumentToS3(req.file.buffer, req.file.originalname, req.file.mimetype);

    // 2. Save the record to the database for the target employee
    connection = await pool.getConnection();
    const sql = `
      INSERT INTO uploaded_document 
      (document_id, user_id, upload_link, upload_date, expiry_date) 
      VALUES (?, ?, ?, CURDATE(), ?);
    `;
    const [result] = await connection.query(sql, [document_id, targetEmployeeId, documentUrl, expiry_date || null]);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully.',
      document: { id: result.insertId, link: documentUrl },
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { uploadDocument };