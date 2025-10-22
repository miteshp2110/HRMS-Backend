const { pool } = require('../../db/connector');
const { uploadDocumentTOS3 } = require('../../services/s3Service');

// Initiate a new case
exports.createCase = async (req, res) => {
    const { employee_id, category_id, title, description, deduction_amount } = req.body;
    const raised_by = req.user.id;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[employee]] = await connection.query('SELECT reports_to FROM user WHERE id = ?', [employee_id]);
        if (!employee || !employee.reports_to) {
            await connection.rollback();
            return res.status(400).json({ message: "Selected employee does not have a reporting manager assigned." });
        }
        const assigned_to = employee.reports_to;
        
        const case_id_text = `CASE-${employee_id}-${Date.now()}`;

        const [result] = await connection.query(
            'INSERT INTO hr_cases (case_id_text, employee_id, category_id, title, description, deduction_amount, raised_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [case_id_text, employee_id, category_id, title, description, deduction_amount || null, raised_by, assigned_to]
        );
        const case_id = result.insertId;

        if (req.file) {
            const fileUrl = await uploadDocumentTOS3(req.file.buffer, req.file.originalname, req.file.mimetype);
            await connection.query('INSERT INTO case_attachments (case_id, file_url, uploaded_by) VALUES (?, ?, ?)', [case_id, fileUrl, raised_by]);
        }
        
        await connection.commit();
        res.status(201).json({ success: true, message: 'Case created successfully.', case_id: case_id_text });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Error creating case.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Get all cases with filters
exports.getAllCases = async (req, res) => {
    const { status, employee_id } = req.query;
    let query = `
        SELECT hc.*, cat.name as category_name, 
               CONCAT(e.first_name, ' ', e.last_name) as employee_name,
               CONCAT(r.first_name, ' ', r.last_name) as raised_by_name,
               CONCAT(a.first_name, ' ', a.last_name) as assigned_to_name
        FROM hr_cases hc
        JOIN case_categories cat ON hc.category_id = cat.id
        JOIN user e ON hc.employee_id = e.id
        JOIN user r ON hc.raised_by = r.id
        JOIN user a ON hc.assigned_to = a.id
    `;
    const params = [];
    if (status) {
        query += ' WHERE hc.status = ?';
        params.push(status);
    }
    if (employee_id) {
        query += status ? ' AND' : ' WHERE';
        query += ' hc.employee_id = ?';
        params.push(employee_id);
    }
    query += ' ORDER BY hc.created_at DESC';

    try {
        const [cases] = await pool.query(query, params);
        res.status(200).json(cases);
    } catch (error) {
        res.status(500).json({ message: "Error fetching cases.", error: error.message });
    }
};

/**
 * @description Get a single, detailed case by its ID.
 */
exports.getCaseById = async (req, res) => {
    const { caseId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Get the main case details
        const [[caseDetails]] = await connection.query(`
            SELECT hc.*, cat.name as category_name, 
                   CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                   CONCAT(r.first_name, ' ', r.last_name) as raised_by_name,
                   CONCAT(a.first_name, ' ', a.last_name) as assigned_to_name
            FROM hr_cases hc
            JOIN case_categories cat ON hc.category_id = cat.id
            JOIN user e ON hc.employee_id = e.id
            JOIN user r ON hc.raised_by = r.id
            JOIN user a ON hc.assigned_to = a.id
            WHERE hc.id = ?
        `, [caseId]);

        if (!caseDetails) {
            return res.status(404).json({ message: "Case not found." });
        }

        // 2. Get all attachments for the case
        const [attachments] = await connection.query('SELECT * FROM case_attachments WHERE case_id = ?', [caseId]);

        // 3. Get all comments for the case
        const [comments] = await connection.query(`
            SELECT cc.comment, cc.created_at, CONCAT(u.first_name, ' ', u.last_name) as author_name
            FROM case_comments cc
            JOIN user u ON cc.user_id = u.id
            WHERE cc.case_id = ?
            ORDER BY cc.created_at ASC
        `, [caseId]);
        
        // 4. Combine and send the response
        const response = {
            ...caseDetails,
            attachments,
            comments
        };

        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ message: "Error fetching case details.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};




// Get cases assigned to the logged-in manager for approval
exports.getApprovalQueue = async (req, res) => {
    const managerId = req.user.id;
    try {
        const [cases] = await pool.query(`
            SELECT hc.*, cat.name as category_name, 
                   CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM hr_cases hc
            JOIN case_categories cat ON hc.category_id = cat.id
            JOIN user e ON hc.employee_id = e.id
            WHERE hc.assigned_to = ? AND hc.status = 'Open'
        `, [managerId]);
        res.status(200).json(cases);
    } catch (error) {
        res.status(500).json({ message: "Error fetching approval queue.", error: error.message });
    }
};


// Manager approves or rejects a case
exports.processCaseApproval = async (req, res) => {
    const { caseId } = req.params;
    const { status, rejection_reason } = req.body;
    const managerId = req.user.id;

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
    }

    try {
        const [result] = await pool.query(
            "UPDATE hr_cases SET status = ?, rejection_reason = ? WHERE id = ? AND assigned_to = ? AND status = 'Open'",
            [status, status === 'Rejected' ? rejection_reason : null, caseId, managerId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Case not found or you are not authorized to process it." });
        }
        res.status(200).json({ success: true, message: `Case has been ${status.toLowerCase()}.` });
    } catch (error) {
        res.status(500).json({ message: "Error processing case.", error: error.message });
    }
};

// Sync deduction to payroll (this is a placeholder for actual integration)
exports.syncDeductionToPayroll = async (req, res) => {
    const { caseId } = req.params;
    try {
        // In a real scenario, this would create a record in a payroll deductions table.
        // For now, we just mark the case as synced.
        await pool.query("UPDATE hr_cases SET is_deduction_synced = TRUE  WHERE id = ? AND status = 'Approved'", [caseId]);
        res.status(200).json({ success: true, message: "Deduction synced to payroll and case is now closed." });
    } catch (error) {
        res.status(500).json({ message: "Error syncing deduction.", error: error.message });
    }
};

/**
 * @description Gets all detailed cases for a specific employee.
 */
exports.getCasesByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [cases] = await connection.query(`
            SELECT hc.*, cat.name as category_name,
                   CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                   CONCAT(r.first_name, ' ', r.last_name) as raised_by_name,
                   CONCAT(a.first_name, ' ', a.last_name) as assigned_to_name
            FROM hr_cases hc
            JOIN case_categories cat ON hc.category_id = cat.id
            JOIN user e ON hc.employee_id = e.id
            JOIN user r ON hc.raised_by = r.id
            JOIN user a ON hc.assigned_to = a.id
            WHERE hc.employee_id = ?
            ORDER BY hc.created_at DESC
        `, [employeeId]);

        if (cases.length === 0) {
            return res.status(200).json([]);
        }

        const detailedCases = [];
        for (const caseItem of cases) {
            const [attachments] = await connection.query('SELECT * FROM case_attachments WHERE case_id = ?', [caseItem.id]);
            const [comments] = await connection.query(`
                SELECT cc.comment, cc.created_at, CONCAT(u.first_name, ' ', u.last_name) as author_name
                FROM case_comments cc
                JOIN user u ON cc.user_id = u.id
                WHERE cc.case_id = ?
                ORDER BY cc.created_at ASC
            `, [caseItem.id]);
            detailedCases.push({
                ...caseItem,
                attachments,
                comments
            });
        }

        res.status(200).json(detailedCases);
    } catch (error) {
        res.status(500).json({ message: "Error fetching cases for employee.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets all detailed cases for the currently authenticated user.
 */
exports.getMyCases = async (req, res) => {
    const employee_id = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const [cases] = await connection.query(`
            SELECT hc.*, cat.name as category_name,
                   CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                   CONCAT(r.first_name, ' ', r.last_name) as raised_by_name,
                   CONCAT(a.first_name, ' ', a.last_name) as assigned_to_name
            FROM hr_cases hc
            JOIN case_categories cat ON hc.category_id = cat.id
            JOIN user e ON hc.employee_id = e.id
            JOIN user r ON hc.raised_by = r.id
            JOIN user a ON hc.assigned_to = a.id
            WHERE hc.employee_id = ?
            ORDER BY hc.created_at DESC
        `, [employee_id]);

        if (cases.length === 0) {
            return res.status(200).json([]);
        }

        const detailedCases = [];
        for (const caseItem of cases) {
            const [attachments] = await connection.query('SELECT * FROM case_attachments WHERE case_id = ?', [caseItem.id]);
            const [comments] = await connection.query(`
                SELECT cc.comment, cc.created_at, CONCAT(u.first_name, ' ', u.last_name) as author_name
                FROM case_comments cc
                JOIN user u ON cc.user_id = u.id
                WHERE cc.case_id = ?
                ORDER BY cc.created_at ASC
            `, [caseItem.id]);
            detailedCases.push({
                ...caseItem,
                attachments,
                comments
            });
        }

        res.status(200).json(detailedCases);
    } catch (error) {
        res.status(500).json({ message: "Error fetching your cases.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};