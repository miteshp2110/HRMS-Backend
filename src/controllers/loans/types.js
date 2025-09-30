const { pool } = require('../../db/connector');

/**
 * @description [Admin] Creates a new loan type (e.g., Personal Loan, Salary Advance).
 */
const createLoanType = async (req, res) => {
    const { name, is_advance, interest_rate, max_tenure_months, eligibility_percentage } = req.body;
    const updated_by = req.user.id;

    if (!name || is_advance === undefined || interest_rate===undefined || !max_tenure_months || !eligibility_percentage) {
        return res.status(400).json({ message: 'All fields are required to create a loan type.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            INSERT INTO loan_types (name, is_advance, interest_rate, max_tenure_months, eligibility_percentage, updated_by)
            VALUES (?, ?, ?, ?, ?, ?);
        `;
        const [result] = await connection.query(sql, [name, is_advance, interest_rate, max_tenure_months, eligibility_percentage, updated_by]);

        res.status(201).json({
            success: true,
            message: 'Loan type created successfully.',
            loanTypeId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A loan type with this name already exists.' });
        }
        console.error('Error creating loan type:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets a list of all active loan types.
 */
const getAllLoanTypes = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [types] = await connection.query('SELECT * FROM loan_types WHERE is_active = TRUE ORDER BY name ASC');
        res.status(200).json(types);
    } catch (error) {
        console.error('Error fetching loan types:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Updates an existing loan type.
 */
const updateLoanType = async (req, res) => {
    const { id } = req.params;
    const fieldsToUpdate = req.body;
    const updated_by = req.user.id;
    delete fieldsToUpdate.created_at
    delete fieldsToUpdate.updated_at
    delete fieldsToUpdate.updated_by

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'At least one field to update is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const fieldEntries = Object.entries(fieldsToUpdate);
        const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
        const values = fieldEntries.map(([, value]) => value);
        values.push(updated_by, id);

        const sql = `UPDATE loan_types SET ${setClause}, updated_by = ? WHERE id = ?;`;
        const [result] = await connection.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Loan type not found.' });
        }

        res.status(200).json({ success: true, message: 'Loan type updated successfully.' });
    } catch (error) {
        console.error('Error updating loan type:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    createLoanType,
    getAllLoanTypes,
    updateLoanType
};