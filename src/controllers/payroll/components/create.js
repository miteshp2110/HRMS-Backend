const { pool } = require('../../../db/connector');

/**
 * @description Creates a new payroll component (earning or deduction).
 */
const createComponent = async (req, res) => {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required.' });
  }

  const allowedTypes = ['earning', 'deduction'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ message: "Type must be either 'earning' or 'deduction'." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO payroll_components (name, type) VALUES (?, ?)',
      [name, type]
    );
    res.status(201).json({
      success: true,
      message: 'Payroll component created successfully.',
      component: { id: result.insertId, name, type },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A payroll component with this name already exists.' });
    }
    console.error('Error creating payroll component:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createComponent };