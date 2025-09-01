const { pool } = require('../../db/connector');

/**
 * @description Create a new leave type.
 */
const createLeaveType = async (req, res) => {
  const {
    name,
    description,
    initial_balance = 0,
    accurable = false,
    accural_rate = 0,
    max_balance = 0,
  } = req.body;

  if (!name || !description) {
    return res.status(400).json({ message: 'Name and description are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      INSERT INTO leave_types 
      (name, description, initial_balance, accurable, accural_rate, max_balance) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await connection.query(sql, [
      name,
      description,
      initial_balance,
      accurable,
      accural_rate,
      max_balance,
    ]);
    res.status(201).json({
      success: true,
      message: 'Leave type created successfully.',
      leaveType: { id: result.insertId, ...req.body },
    });
  } catch (error) {
    console.error('Error creating leave type:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createLeaveType };