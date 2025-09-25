const { pool } = require('../../db/connector');
const { uploadDocumentTOS3 } = require('../../services/s3Service'); // Assuming a generic S3 upload service

/**
 * @description [Employee] Creates a new expense claim for reimbursement.
 */
const createExpenseClaim = async (req, res) => {
    const employee_id = req.user.id;
    const { category_id, title, description, amount, expense_date } = req.body;

    if (!category_id || !title || !amount || !expense_date) {
        return res.status(400).json({ message: 'Category, title, amount, and expense date are required.' });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'A receipt file is required for expense claims.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Create the main expense claim record
        const claimSql = `
            INSERT INTO expense_claims (claim_type, employee_id, category_id, title, description, amount, expense_date, updated_by)
            VALUES ('Reimbursement', ?, ?, ?, ?, ?, ?, ?);
        `;
        const [claimResult] = await connection.query(claimSql, [employee_id, category_id, title, description, amount, expense_date, employee_id]);
        const expense_claim_id = claimResult.insertId;

        // 2. Upload the receipt to S3
        const fileUrl = await uploadDocumentTOS3(req.file.buffer, req.file.originalname, req.file.mimetype);

        // 3. Create the receipt record linked to the claim
        const receiptSql = `
            INSERT INTO expense_receipts (expense_claim_id, file_url, uploaded_by)
            VALUES (?, ?, ?);
        `;
        await connection.query(receiptSql, [expense_claim_id, fileUrl, employee_id]);

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Expense claim submitted successfully. It is now pending approval.',
            claimId: expense_claim_id
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error creating expense claim:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Creates a new expense advance for an employee.
 */
const createExpenseAdvance = async (req, res) => {
    const processed_by = req.user.id;
    const { employee_id, category_id, title, description, amount, expense_date, transaction_id } = req.body;

    if (!employee_id || !category_id || !title || !amount || !expense_date) {
        return res.status(400).json({ message: 'Employee, category, title, amount, and date are required for an advance.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            INSERT INTO expense_claims (claim_type, employee_id, category_id, title, description, amount, expense_date, status, processed_by, processed_date, transaction_id, updated_by)
            VALUES ('Advance', ?, ?, ?, ?, ?, ?, 'Processed', ?, NOW(), ?, ?);
        `;
        const [result] = await connection.query(sql, [employee_id, category_id, title, description, amount, expense_date, processed_by, transaction_id || null, processed_by]);

        res.status(201).json({
            success: true,
            message: 'Expense advance recorded successfully.',
            claimId: result.insertId
        });
    } catch (error) {
        console.error('Error creating expense advance:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets expense claims based on user role and query filters, including receipt URLs.
 */
const getExpenseClaims = async (req, res) => {
    const requester = req.user;
    const { employee_id, status, claim_type } = req.query;
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
        `;
        const params = [];

        // If not an admin, user can only see their own claims
        if (!requester.permissions.includes('expenses.manage')) {
            sql += ' WHERE ec.employee_id = ?';
            params.push(requester.id);
        } else if (employee_id) {
            sql += ' WHERE ec.employee_id = ?';
            params.push(employee_id);
        }

        // Add additional filters
        const addAnd = () => (sql.includes('WHERE') ? ' AND' : ' WHERE');
        if (status) {
            sql += `${addAnd()} ec.status = ?`;
            params.push(status);
        }
        if (claim_type) {
            sql += `${addAnd()} ec.claim_type = ?`;
            params.push(claim_type);
        }

        sql += ' ORDER BY ec.expense_date DESC;';
        
        const [claims] = await connection.query(sql, params);
        res.status(200).json(claims);

    } catch (error) {
        console.error('Error fetching expense claims:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createExpenseClaim,
    createExpenseAdvance,
    getExpenseClaims
};