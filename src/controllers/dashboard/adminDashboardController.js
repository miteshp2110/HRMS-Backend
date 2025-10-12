const {
    pool
} = require('../../db/connector');
const {
    DateTime
} = require('luxon');

/**
 * @description Widget 1: Gets today's attendance summary (Total, Present, Absent, Leave).
 */
exports.getTodayAttendanceStats = async (req, res) => {
    const today = DateTime.now().toISODate();
    let connection;
    try {
        connection = await pool.getConnection();

        const [[{
            total_employees
        }]] = await connection.query("SELECT COUNT(*) as total_employees FROM user WHERE is_active = TRUE AND is_payroll_exempt = FALSE");

        const [attendanceResults] = await connection.query(
            "SELECT attendance_status, COUNT(*) as count FROM attendance_record WHERE attendance_date = ? GROUP BY attendance_status",
            [today]
        );

        const stats = {
            total: total_employees,
            present: 0,
            absent: 0,
            leave: 0
        };

        attendanceResults.forEach(row => {
            if (row.attendance_status === 'Present' || row.attendance_status === 'Half-Day') {
                stats.present += row.count;
            } else if (row.attendance_status === 'Absent') {
                stats.absent += row.count;
            } else if (row.attendance_status === 'Leave') {
                stats.leave += row.count;
            }
        });

        res.status(200).json(stats);

    } catch (error) {
        console.error('Error fetching today\'s attendance stats:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description Widget 2: Gets leave requests pending approval for the current user.
 */
exports.getPendingLeaveApprovals = async (req, res) => {
    const approverId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                lr.id, lr.applied_date, lr.from_date, lr.to_date,
                lt.name as leave_type_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                e.profile_url
            FROM employee_leave_records lr
            JOIN user e ON lr.employee_id = e.id
            JOIN leave_types lt ON lr.leave_type = lt.id
            WHERE lr.primary_user = ? AND lr.primary_status IS NULL AND lr.rejection_reason IS NULL
            ORDER BY lr.applied_date ASC;
        `;
        const [requests] = await connection.query(sql, [approverId]);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching pending leave approvals:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 3: Gets loan applications pending approval.
 */
exports.getPendingLoanApprovals = async (req, res) => {
    const approverId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                la.id, la.application_id_text, la.created_at as request_date, la.requested_amount,
                lt.name as loan_type_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                e.profile_url
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN user e ON la.employee_id = e.id
            WHERE la.status = 'Pending Approval' AND e.reports_to = ? AND la.manager_approver_id IS NULL
            ORDER BY la.created_at ASC;
        `;
        const [requests] = await connection.query(sql, [approverId]);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching pending loan approvals:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 4: Gets skill requests pending approval for the manager's direct reports.
 */
exports.getPendingSkillApprovals = async (req, res) => {
    const managerId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                esm.id, esm.created_at as request_date,
                s.skill_name,
                CONCAT(u.first_name, ' ', u.last_name) as employee_name,
                u.profile_url
            FROM employee_skill_matrix esm
            JOIN user u ON esm.employee_id = u.id
            JOIN skills s ON esm.skill_id = s.id
            WHERE u.reports_to = ? AND esm.status IS NULL
            ORDER BY esm.created_at ASC;
        `;
        const [requests] = await connection.query(sql, [managerId]);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching pending skill approvals:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 5: Gets expense claims pending approval for the manager's direct reports.
 */
exports.getPendingExpenseApprovals = async (req, res) => {
    const managerId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                ec.id, ec.created_at as request_date, ec.title, ec.amount,
                cat.name as category_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                e.profile_url
            FROM expense_claims ec
            JOIN user e ON ec.employee_id = e.id
            JOIN expense_categories cat ON ec.category_id = cat.id
            WHERE e.reports_to = ? AND ec.status = 'Pending'
            ORDER BY ec.created_at ASC;
        `;
        const [claims] = await connection.query(sql, [managerId]);
        res.status(200).json(claims);
    } catch (error) {
        console.error('Error fetching pending expense approvals:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 6: Gets overtime requests pending approval for the manager's direct reports.
 */
exports.getPendingOvertimeRequests = async (req, res) => {
    const managerId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                eor.id, eor.request_date, eor.overtime_hours, eor.overtime_type,
                CONCAT(u.first_name, ' ', u.last_name) as employee_name,
                u.profile_url
            FROM employee_overtime_records eor
            JOIN user u ON eor.employee_id = u.id
            WHERE u.reports_to = ? AND eor.status = 'pending_approval'
            ORDER BY eor.request_date ASC;
        `;
        const [requests] = await connection.query(sql, [managerId]);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching pending overtime requests:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 7: Gets documents expiring within a specified number of days (default 30).
 */
exports.getUpcomingDocumentExpiries = async (req, res) => {
    const days = req.query.days || 30;
    const today = DateTime.now().toISODate();
    const futureDate = DateTime.now().plus({
        days
    }).toISODate();
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                ud.id, ud.expiry_date,
                rd.name as document_name,
                CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
                u.profile_url, u.id as employee_id
            FROM uploaded_document ud
            JOIN required_documents rd ON ud.document_id = rd.id
            JOIN user u ON ud.user_id = u.id
            WHERE u.is_active = 1 AND ud.expiry_date BETWEEN ? AND ?
            ORDER BY ud.expiry_date ASC;
        `;
        const [documents] = await connection.query(sql, [today, futureDate]);
        res.status(200).json(documents);
    } catch (error) {
        console.error('Error fetching upcoming document expiries:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 8: Gets open HR cases for the manager's direct reports.
 */
exports.getOpenCasesOnDirectReports = async (req, res) => {
    const managerId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                hc.id, hc.case_id_text, hc.title, hc.created_at,
                cat.name as category_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                e.profile_url
            FROM hr_cases hc
            JOIN user e ON hc.employee_id = e.id
            JOIN case_categories cat ON hc.category_id = cat.id
            WHERE e.reports_to = ? AND hc.status = 'Open'
            ORDER BY hc.created_at DESC;
        `;
        const [cases] = await connection.query(sql, [managerId]);
        res.status(200).json(cases);
    } catch (error) {
        console.error('Error fetching open cases on direct reports:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 9: Gets expense claims ready for disbursement (status 'Approved').
 */
exports.getExpenseDisbursementRequests = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                ec.id, ec.approval_date, ec.title, ec.amount, ec.claim_type,
                cat.name as category_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                e.profile_url
            FROM expense_claims ec
            JOIN expense_categories cat ON ec.category_id = cat.id
            JOIN user e ON ec.employee_id = e.id
            WHERE ec.status = 'Approved'
            ORDER BY ec.approval_date ASC;
        `;
        const [claims] = await connection.query(sql);
        res.status(200).json(claims);
    } catch (error) {
        console.error('Error fetching expense disbursement requests:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 10: Gets loan applications ready for disbursement (status 'Approved').
 */
exports.getLoanDisbursementRequests = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                la.id, la.application_id_text, la.updated_at as approval_date, la.approved_amount,
                lt.name as loan_type_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                e.profile_url
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN user e ON la.employee_id = e.id
            WHERE la.status = 'Approved'
            ORDER BY la.updated_at ASC;
        `;
        const [applications] = await connection.query(sql);
        res.status(200).json(applications);
    } catch (error) {
        console.error('Error fetching loan disbursement requests:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Widget 11: Gets leave encashment requests pending approval or disbursement.
 */
exports.getPendingLeaveEncashmentRequests = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                ler.id, ler.request_date, ler.days_to_encash, ler.calculated_amount, ler.status,
                CONCAT(u.first_name, ' ', u.last_name) as employee_name,
                u.profile_url
            FROM leave_encashment_requests ler
            JOIN user u ON ler.employee_id = u.id
            WHERE ler.status IN ('Pending', 'Approved')
            ORDER BY ler.request_date ASC;
        `;
        const [requests] = await connection.query(sql);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching leave encashment requests:', error);
        res.status(500).json({
            message: 'An internal server error occurred.'
        });
    } finally {
        if (connection) connection.release();
    }
};