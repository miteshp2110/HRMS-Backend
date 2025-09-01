const { pool } = require('../../db/connector');

/**
 * @description Get expense records. If an employee_id is provided in the query,
 * it fetches expenses for that employee. Otherwise, it fetches all expenses.
 */
const getExpenses = async (req, res) => {
  const { employee_id } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    let sql = `
      SELECT e.*, u.first_name, u.last_name 
      FROM expense_on_employee e
      JOIN user u ON e.employee_id = u.id
    `;
    const params = [];

    if (employee_id) {
      sql += ' WHERE e.employee_id = ?';
      params.push(employee_id);
    }
    
    sql += ' ORDER BY e.created_at DESC';

    const [expenses] = await connection.query(sql, params);
    res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Get a single expense record by its ID.
 */
const getExpenseById = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT e.*, u.first_name, u.last_name 
      FROM expense_on_employee e
      JOIN user u ON e.employee_id = u.id
      WHERE e.id = ?
    `;
    const [[expense]] = await connection.query(sql, [id]);

    if (!expense) {
      return res.status(404).json({ message: 'Expense record not found.' });
    }

    res.status(200).json(expense);
  } catch (error) {
    console.error('Error fetching expense by ID:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Get all expense records for a specific employee by their ID.
 * Authorization is handled inside: users can see their own expenses,
 * while users with 'expenses.manage' permission can see anyone's.
 */
const getExpensesByEmployee = async (req, res) => {
  const { id } = req.params;
  
  let connection;
  try {
    connection = await pool.getConnection();
    // First, verify the employee exists
    const [[employee]] = await connection.query('SELECT id FROM user WHERE id = ?', [id]);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    // Fetch all expenses for that employee
    const sql = 'SELECT * FROM expense_on_employee WHERE employee_id = ? ORDER BY created_at DESC';
    const [expenses] = await connection.query(sql, [id]);

    res.status(200).json(expenses);
  } catch (error) {
    console.error(`Error fetching expenses for employee ${id}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { 
  getExpenses, 
  getExpenseById, 
  getExpensesByEmployee 
};
