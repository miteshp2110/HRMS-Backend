const { pool } = require('../../db/connector');

/**
 * @description Create a new expense record for an employee.
 */
const createExpense = async (req, res) => {
  const { employee_id, expense_title, expense_description, expense , jv} = req.body;

  if (!employee_id || !expense_title || !expense_description || expense === undefined || !jv) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      INSERT INTO expense_on_employee 
      (employee_id, expense_title, expense_description, expense,jv) 
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await connection.query(sql, [
      employee_id,
      expense_title,
      expense_description,
      expense,
      jv
    ]);
    res.status(201).json({
      success: true,
      message: 'Expense record created successfully.',
      expense: { id: result.insertId, ...req.body },
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createExpense };