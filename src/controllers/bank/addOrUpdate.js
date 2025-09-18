// const { pool } = require('../../db/connector');

// /**
//  * @description Adds or updates the bank details for a specific employee.
//  */
// const addOrUpdateBankDetails = async (req, res) => {
//   const { employeeId } = req.params;
//   const { bank_name, bank_account, bank_ifsc } = req.body;

//   if (!bank_name || !bank_account || !bank_ifsc) {
//     return res.status(400).json({ message: 'Bank name, account number, and IFSC code are required.' });
//   }

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     // This single query will insert a new record, or on duplicate user_id, update the existing one.
//     const sql = `
//       INSERT INTO bank_details (user_id, bank_name, bank_account, bank_ifsc)
//       VALUES (?, ?, ?, ?)
//       ON DUPLICATE KEY UPDATE
//         bank_name = VALUES(bank_name),
//         bank_account = VALUES(bank_account),
//         bank_ifsc = VALUES(bank_ifsc);
//     `;
    
//     await connection.query(sql, [employeeId, bank_name, bank_account, bank_ifsc]);

//     res.status(200).json({
//       success: true,
//       message: 'Bank details saved successfully.',
//     });
//   } catch (error) {
//     console.error(`Error saving bank details for employee ${employeeId}:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { addOrUpdateBankDetails };


const { pool } = require('../../db/connector');

/**
 * @description Adds or updates the bank details for a specific employee.
 */
const addOrUpdateBankDetails = async (req, res) => {
  const { employeeId } = req.params;
  const { bank_name, bank_account, bank_ifsc } = req.body;
  const updated_by = req.user.id; // Get the ID of the user making the change

  if (!bank_name || !bank_account || !bank_ifsc) {
    return res.status(400).json({ message: 'Bank name, account number, and IFSC code are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // This single query will insert a new record, or on duplicate user_id, update the existing one.
    const sql = `
      INSERT INTO bank_details (user_id, bank_name, bank_account, bank_ifsc, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        bank_name = VALUES(bank_name),
        bank_account = VALUES(bank_account),
        bank_ifsc = VALUES(bank_ifsc),
        updated_by = VALUES(updated_by),
        updated_at = NOW();
    `;
    
    await connection.query(sql, [employeeId, bank_name, bank_account, bank_ifsc, updated_by]);

    res.status(200).json({
      success: true,
      message: 'Bank details saved successfully.',
    });
  } catch (error) {
    console.error(`Error saving bank details for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { addOrUpdateBankDetails };