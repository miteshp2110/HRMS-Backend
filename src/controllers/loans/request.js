const { pool } = require('../../db/connector');


/**
 * @description Creates a new loan or advance request for the authenticated user,
 * with validation for advance amount against basic salary.
 */
const requestLoan = async (req, res) => {
  const employeeId = req.user.id;
  const { loan_type, title, description, principal_amount, total_installments } = req.body;

  if (!loan_type || !title || !principal_amount || !total_installments) {
    return res.status(400).json({ message: 'loan_type, title, principal_amount, and total_installments are required.' });
  }
  if (loan_type === 'advance' && total_installments !== 1) {
      return res.status(400).json({ message: 'Salary advances must have exactly 1 installment.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // --- NEW: Validation for Salary Advance ---
    if (loan_type === 'advance') {
      // Find the employee's basic salary from their salary structure.
      const salarySql = `
        SELECT ess.value 
        FROM employee_salary_structure ess
        JOIN payroll_components pc ON ess.component_id = pc.id
        WHERE ess.employee_id = ? 
        AND ess.value_type = 'fixed' 
        AND pc.id = 1
      `;
      const [[basicSalary]] = await connection.query(salarySql, [employeeId]);

      if (!basicSalary || !basicSalary.value) {
        await connection.rollback();
        return res.status(400).json({ message: 'Cannot request advance. Your basic salary is not set.' });
      }

      if (parseFloat(principal_amount) > parseFloat(basicSalary.value)) {
        await connection.rollback();
        return res.status(400).json({ 
          message: `Salary advance amount cannot exceed your basic salary of ${basicSalary.value}.` 
        });
      }
    }

    const emi_amount = (principal_amount / total_installments).toFixed(2);

    const sql = `
      INSERT INTO employee_loans 
      (employee_id, loan_type, title, description, principal_amount, emi_amount, total_installments, remaining_installments, request_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
    `;
    const [result] = await connection.query(sql, [
      employeeId, loan_type, title, description || null, principal_amount, emi_amount, total_installments, total_installments
    ]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Loan request submitted successfully.',
      loan: { id: result.insertId, ...req.body, emi_amount },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating loan request:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets the loan history for the currently authenticated user.
 */
const getMyLoans = async (req, res) => {
    const employeeId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT l.*, CONCAT(u.first_name, ' ', u.last_name) as approved_by_name
            FROM employee_loans l
            LEFT JOIN user u ON l.approved_by = u.id
            WHERE l.employee_id = ?
            ORDER BY l.request_date DESC
        `;
        const [loans] = await connection.query(sql, [employeeId]);
        res.status(200).json(loans);
    } catch (error) {
        console.error('Error fetching my loans:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets all loan records for a specific employee, regardless of status.
 * Security: Checks if the requester is the owner of the loans or an admin.
 */
const getLoansByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    const requester = req.user;
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Security check: Allow if the user is requesting their own loans OR if they have admin rights
        const isRequestingSelf = requester.id.toString() === employeeId;
        const isAdmin = requester.permissions.includes('loans.manage');
        if (!isRequestingSelf && !isAdmin) {
            return res.status(403).json({ message: 'Forbidden. You do not have permission to view these loans.' });
        }
        
        // 2. Fetch all loans for the employee
        const sql = `
            SELECT l.*, CONCAT(u.first_name, ' ', u.last_name) as approved_by_name
            FROM employee_loans l
            LEFT JOIN user u ON l.approved_by = u.id
            WHERE l.employee_id = ?
            ORDER BY l.request_date DESC;
        `;
        const [loans] = await connection.query(sql, [employeeId]);
        res.status(200).json(loans);
    } catch (error) {
        console.error(`Error fetching loans for employee ${employeeId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { requestLoan, getMyLoans,getLoansByEmployee };