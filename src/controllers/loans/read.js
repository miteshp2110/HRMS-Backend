const { pool } = require('../../db/connector');

/**
 * @description Gets all loan applications based on user role and filters.
 */
const getLoanApplications = async (req, res) => {
    const requester = req.user;
    const { employee_id, status, loan_type_id } = req.query;
    let connection;

    try {
        connection = await pool.getConnection();
        let sql = `
            SELECT
                la.*,
                lt.name as loan_type_name,
                lt.is_advance,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN user e ON la.employee_id = e.id
        `;
        const params = [];

        // If not an admin, user can only see their own applications
        if (!requester.permissions.includes('loans.manage')) {
            sql += ' WHERE la.employee_id = ?';
            params.push(requester.id);
        } else if (employee_id) {
            sql += ' WHERE la.employee_id = ?';
            params.push(employee_id);
        }

        const addAnd = () => (sql.includes('WHERE') ? ' AND' : ' WHERE');
        if (status) {
            sql += `${addAnd()} la.status = ?`;
            params.push(status);
        }
        if (loan_type_id) {
            sql += `${addAnd()} la.loan_type_id = ?`;
            params.push(loan_type_id);
        }

        sql += ' ORDER BY la.created_at DESC;';
        
        const [applications] = await connection.query(sql, params);
        res.status(200).json(applications);

    } catch (error) {
        console.error('Error fetching loan applications:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets the complete details of a single loan application, including its amortization and repayment history.
 */
const getLoanApplicationById = async (req, res) => {
    const { applicationId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        // Fetch main application details along with all related names and info
        const appSql = `
            SELECT
                la.*,
                lt.name as loan_type_name,
                lt.is_advance,
                lt.interest_rate as default_interest_rate,
                lt.max_tenure_months,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                CONCAT(ma.first_name, ' ', ma.last_name) as manager_approver_name,
                CONCAT(ha.first_name, ' ', ha.last_name) as hr_approver_name
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN user e ON la.employee_id = e.id
            LEFT JOIN user ma ON la.manager_approver_id = ma.id
            LEFT JOIN user ha ON la.hr_approver_id = ha.id
            WHERE la.id = ?;
        `;
        const [[application]] = await connection.query(appSql, [applicationId]);

        if (!application) {
            return res.status(404).json({ message: 'Loan application not found.' });
        }

        // Fetch amortization schedule if it exists
        const scheduleSql = 'SELECT * FROM loan_amortization_schedule WHERE loan_application_id = ? ORDER BY due_date ASC;';
        const [amortization_schedule] = await connection.query(scheduleSql, [applicationId]);
        
        // Fetch repayment history
        const repaymentsSql = 'SELECT * FROM loan_repayments WHERE loan_application_id = ? ORDER BY repayment_date ASC;';
        const [manual_repayments] = await connection.query(repaymentsSql, [applicationId]);

        res.status(200).json({
            ...application,
            amortization_schedule,
            manual_repayments
        });

    } catch (error) {
        console.error('Error fetching loan application details:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};
/**
 * @description Gets a list of all ongoing (disbursed) loans for a specific employee.
 */
const getOngoingLoansByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                la.id,
                la.application_id_text,
                la.approved_amount,
                la.emi_amount,
                la.tenure_months,
                lt.name as loan_type_name,
                CONCAT(ns.prefix, LPAD(la.id, ns.padding_length, '0')) as full_loan_id,
                (SELECT COUNT(*) FROM loan_amortization_schedule WHERE loan_application_id = la.id AND status = 'Paid') as emis_paid,
                (SELECT COUNT(*) FROM loan_amortization_schedule WHERE loan_application_id = la.id) as total_emis
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            LEFT JOIN name_series ns ON ns.table_name = 'loan_applications'
            WHERE la.employee_id = ? AND la.status = 'Disbursed';
        `;
        const [loans] = await connection.query(sql, [employeeId]);
        res.status(200).json(loans);
    } catch (error) {
        console.error(`Error fetching ongoing loans for employee ${employeeId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    getLoanApplications,
    getLoanApplicationById,
    getOngoingLoansByEmployee
};