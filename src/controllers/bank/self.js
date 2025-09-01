const { pool } = require('../../db/connector');

/**
 * @description Adds or updates the bank details for the currently authenticated user.
 */
const addOrUpdateMyBankDetails = async (req, res) => {
  const employeeId = req.user.id; // ID is taken securely from the token
  const { bank_name, bank_account, bank_ifsc } = req.body;

  if (!bank_name || !bank_account || !bank_ifsc) {
    return res.status(400).json({ message: 'Bank name, account number, and IFSC code are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // Use an "upsert" query to either insert a new record or update the existing one
    const sql = `
      INSERT INTO bank_details (user_id, bank_name, bank_account, bank_ifsc)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        bank_name = VALUES(bank_name),
        bank_account = VALUES(bank_account),
        bank_ifsc = VALUES(bank_ifsc);
    `;
    
    await connection.query(sql, [employeeId, bank_name, bank_account, bank_ifsc]);

    res.status(200).json({
      success: true,
      message: 'Your bank details have been saved successfully.',
    });
  } catch (error) {
    console.error(`Error saving bank details for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets the bank details for the currently authenticated user.
 */
const getMyBankDetails = async (req, res) => {
    const employeeId = req.user.id; // ID is taken securely from the token
    let connection;
    try {
      connection = await pool.getConnection();
      const sql = 'SELECT * FROM bank_details WHERE user_id = ?';
      const [[details]] = await connection.query(sql, [employeeId]);
  
      if (!details) {
        return res.status(404).json({ message: 'You have not added your bank details yet.' });
      }
  
      res.status(200).json(details);
    } catch (error) {
      console.error(`Error fetching bank details for employee ${employeeId}:`, error);
      res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
      if (connection) connection.release();
    }
  };

module.exports = { 
    addOrUpdateMyBankDetails,
    getMyBankDetails
};