const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Get a list of all required documents.
 */
const getAllDocuments = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [documents] = await connection.query('SELECT * FROM required_documents ORDER BY name ASC');
    res.status(200).json(documents);
  } catch (error)
 {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};



/**
 * @description Gets all uploaded documents for the currently authenticated user.
 */
const getMyDocuments = async (req, res) => {
  const employee_id = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT ud.*, rd.name AS document_name 
      FROM uploaded_document ud
      JOIN required_documents rd ON ud.document_id = rd.id
      WHERE ud.user_id = ?
    `;
    const [documents] = await connection.query(sql, [employee_id]);
    res.status(200).json(documents);
  } catch (error) {
    console.error('Error fetching my documents:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description [Admin] Gets all uploaded documents for a specific employee.
 */
const getDocumentsByEmployeeId = async (req, res) => {
  const { employeeId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT ud.*, rd.name AS document_name 
      FROM uploaded_document ud
      JOIN required_documents rd ON ud.document_id = rd.id
      WHERE ud.user_id = ?
    `;
    const [documents] = await connection.query(sql, [employeeId]);
    res.status(200).json(documents);
  } catch (error) {
    console.error(`Error fetching documents for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};



/**
 * @description [Admin] Gets a list of all uploaded documents that are expiring based on their individual reminder thresholds.
 */
const getExpiringDocuments = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    // This query now dynamically calculates the expiration window for each document
    // based on the 'reminder_threshold' (in months) set for that document type.
    const sql = `
      SELECT
        ud.id,
        ud.upload_link,
        ud.expiry_date,
        rd.name AS document_name,
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name
      FROM uploaded_document ud
      JOIN required_documents rd ON ud.document_id = rd.id
      JOIN user u ON ud.user_id = u.id
      WHERE
        u.is_active = 1
        AND ud.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL rd.reminder_threshold MONTH)
      ORDER BY ud.expiry_date ASC;
    `;
    const [documents] = await connection.query(sql);

    res.status(200).json(documents);
  } catch (error) {
    console.error('Error fetching expiring documents:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllDocuments ,getMyDocuments,
  getDocumentsByEmployeeId,getExpiringDocuments};