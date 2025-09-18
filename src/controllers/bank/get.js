// const { pool } = require('../../db/connector');

// /**
//  * @description Get the bank details for a specific employee.
//  */
// const getBankDetails = async (req, res) => {
//   const { employeeId } = req.params;
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     const sql = 'SELECT * FROM bank_details WHERE user_id = ?';
//     const [[details]] = await connection.query(sql, [employeeId]);

//     if (!details) {
//       return res.status(404).json({ message: 'No bank details found for this employee.' });
//     }

//     res.status(200).json(details);
//   } catch (error) {
//     console.error(`Error fetching bank details for employee ${employeeId}:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { getBankDetails };

const { pool } = require('../../db/connector');

/**
 * @description Get the bank details for a specific employee.
 */
const getBankDetails = async (req, res) => {
  const { employeeId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
        SELECT
            bd.*,
            ns.prefix,
            CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
        FROM bank_details bd
        LEFT JOIN user u ON bd.updated_by = u.id
        LEFT JOIN name_series ns ON ns.table_name = 'user'
        WHERE bd.user_id = ?
    `;
    const [[details]] = await connection.query(sql, [employeeId]);

    if (!details) {
      return res.status(404).json({ message: 'No bank details found for this employee.' });
    }

    res.status(200).json(details);
  } catch (error) {
    console.error(`Error fetching bank details for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getBankDetails };