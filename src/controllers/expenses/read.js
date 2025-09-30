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


/**
 * @description Gets a summary of total expenses for each employee who has expenses.
 */
const getEmployeeExpenseSummary = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                e.employee_id AS id,
                CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
                SUM(e.expense) AS total_amount
            FROM expense_on_employee e
            JOIN user u ON e.employee_id = u.id
            GROUP BY e.employee_id, employee_name
            ORDER BY total_amount DESC;
        `;
        const [summary] = await connection.query(sql);
        res.status(200).json(summary);
    } catch (error) {
        console.error('Error fetching employee expense summary:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description [Admin] Gets a list of all claims that are in a 'Processed' or 'Reimbursed' state, with optional date filtering.
 */
const getProcessedClaims = async (req, res) => {
    const { startDate, endDate } = req.query;
    let connection;

    try {
        connection = await pool.getConnection();
        let sql = `
            SELECT
                ec.*,
                cat.name as category_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                CONCAT(a.first_name, ' ', a.last_name) as approver_name,
                CONCAT(p.first_name, ' ', p.last_name) as processor_name,
                er.file_url as receipt_url
            FROM expense_claims ec
            JOIN expense_categories cat ON ec.category_id = cat.id
            JOIN user e ON ec.employee_id = e.id
            LEFT JOIN user a ON ec.approved_by = a.id
            LEFT JOIN user p ON ec.processed_by = p.id
            LEFT JOIN expense_receipts er ON ec.id = er.expense_claim_id
            WHERE ec.status IN ('Processed', 'Reimbursed')
        `;
        const params = [];

        if (startDate && endDate) {
            sql += ` AND ec.expense_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        sql += ' ORDER BY ec.processed_date DESC;';
        
        const [claims] = await connection.query(sql, params);
        res.status(200).json(claims);

    } catch (error) {
        console.error('Error fetching processed claims:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Gets a list of all approved reimbursements that are pending payment in the next payroll.
 */
const getUpcomingPayrollReimbursements = async (req, res) => {
    const { startDate, endDate } = req.query;
    let connection;
    try {
        connection = await pool.getConnection();
        let sql = `
            SELECT
                ec.*,
                cat.name as category_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                CONCAT(a.first_name, ' ', a.last_name) as approver_name,
                CONCAT(p.first_name, ' ', p.last_name) as processor_name,
                er.file_url as receipt_url
            FROM expense_claims ec
            JOIN expense_categories cat ON ec.category_id = cat.id
            JOIN user e ON ec.employee_id = e.id
            LEFT JOIN user a ON ec.approved_by = a.id
            LEFT JOIN user p ON ec.processed_by = p.id
            LEFT JOIN expense_receipts er ON ec.id = er.expense_claim_id
            WHERE ec.status = 'Processed' AND ec.reimbursement_method = 'Payroll'
        `;
        const params = [];

        if (startDate && endDate) {
            sql += ` AND ec.expense_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        sql += ' ORDER BY ec.processed_date DESC;';
        
        const [claims] = await connection.query(sql, params);
        res.status(200).json(claims);
    } catch (error) {
        console.error('Error fetching upcoming payroll reimbursements:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { 
  getExpenses, 
  getExpenseById, 
  getExpensesByEmployee ,
  getEmployeeExpenseSummary,
  getProcessedClaims,
  getUpcomingPayrollReimbursements
};
