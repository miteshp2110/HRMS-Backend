const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description The core engine for calculating an employee's loan eligibility.
 */
const checkEligibility = async (req, res) => {
    const employee_id = req.user.id;
    let connection;

    try {
        connection = await pool.getConnection();

        // --- 1. Fetch all necessary financial data for the employee ---
        const [[financials]] = await connection.query(`
            SELECT
                u.joining_date,
                (SELECT SUM(balance) FROM employee_leave_balance WHERE employee_id = u.id) as total_leave_balance,
                (SELECT value FROM employee_salary_structure WHERE employee_id = u.id AND component_id = 1) as basic_salary,
                (
                    SELECT SUM(ess.value)
                    FROM employee_salary_structure ess
                    JOIN payroll_components pc ON ess.component_id = pc.id
                    WHERE ess.employee_id = u.id AND pc.type = 'earning' AND ess.value_type = 'fixed'
                ) as gross_salary
            FROM user u
            WHERE u.id = ?;
        `, [employee_id]);

        if (!financials || !financials.basic_salary || !financials.gross_salary) {
            return res.status(400).json({ message: "Eligibility cannot be calculated. Please ensure the employee's salary structure is complete." });
        }

        // --- 2. Perform Eligibility Calculations ---
        const yearsOfService = DateTime.now().diff(DateTime.fromJSDate(financials.joining_date), 'years').years;
        const dailyGrossSalary = (financials.gross_salary * 12) / 365;

        const leaveEncashmentLiability = financials.total_leave_balance * dailyGrossSalary;
        const gratuityAccrued = (financials.basic_salary * 15 / 26) * yearsOfService;
        const eligibleBaseAmount = leaveEncashmentLiability + gratuityAccrued;

        // --- 3. Fetch all active loan types and apply percentage limits ---
        const [loanTypes] = await connection.query('SELECT id,max_tenure_months, name, eligibility_percentage, interest_rate, is_advance FROM loan_types WHERE is_active = TRUE');

        const eligibleProducts = loanTypes.map(lt => ({
            loan_type_id: lt.id,
            name: lt.name,
            is_advance: !!lt.is_advance,
            interest_rate: lt.interest_rate,
            max_tenure_months : lt.max_tenure_months,
            max_eligible_amount: parseFloat(((eligibleBaseAmount * lt.eligibility_percentage) / 100).toFixed(2))
        }));

        res.status(200).json({
            eligible_base_amount: parseFloat(eligibleBaseAmount.toFixed(2)),
            eligible_products: eligibleProducts
        });

    } catch (error) {
        console.error('Error in eligibility check:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description [Employee] Submits a new loan or salary advance application.
 */
const applyForLoan = async (req, res) => {
    const employee_id = req.user.id;
    const { loan_type_id, requested_amount, tenure_months, purpose } = req.body;
    
    if (!loan_type_id || !requested_amount || !tenure_months) {
        return res.status(400).json({ message: 'Loan type, requested amount, and tenure are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const year = DateTime.now().year;
        const [[loanType]] = await connection.query('SELECT prefix FROM name_series WHERE table_name = ?', [ loan_type_id === 1 ? 'loan' : 'advance' ]);
        const prefix = loanType ? loanType.prefix : 'LOAN';
        
        const [[last_id]] = await connection.query('SELECT COUNT(*) + 1 as next_id FROM loan_applications WHERE employee_id = ? AND YEAR(created_at) = ?', [employee_id, year]);
        const sequenceNumber = last_id.next_id.toString().padStart(3, '0');
        const application_id_text = `${prefix}-${employee_id}-${year}-${sequenceNumber}`;

        // Fetch the default interest rate for the selected loan type
        const [[defaultLoanType]] = await connection.query('SELECT interest_rate FROM loan_types WHERE id = ?', [loan_type_id]);
        if (!defaultLoanType) {
            await connection.rollback();
            return res.status(400).json({ message: 'Invalid loan type selected.' });
        }

        const sql = `
            INSERT INTO loan_applications (application_id_text, employee_id, loan_type_id, requested_amount, tenure_months, purpose, interest_rate, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const [result] = await connection.query(sql, [application_id_text, employee_id, loan_type_id, requested_amount, tenure_months, purpose, defaultLoanType.interest_rate, employee_id]);

        await connection.commit();
        res.status(201).json({
            success: true,
            message: 'Your application has been submitted successfully and is pending approval.',
            applicationId: result.insertId,
            application_id_text
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error applying for loan:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    checkEligibility,
    applyForLoan
};