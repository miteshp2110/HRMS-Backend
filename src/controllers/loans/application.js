const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');



/**
 * @description Calculate employee loan & advance eligibility.
 */
const checkEligibility = async (req, res) => {
  const employee_id = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Fetch financial data
    const [[financials]] = await connection.query(`
      SELECT
        u.joining_date,
        (SELECT SUM(balance) FROM employee_leave_balance WHERE employee_id = u.id)         AS total_leave_balance,
        (SELECT value FROM employee_salary_structure WHERE employee_id = u.id AND component_id = 1 LIMIT 1) AS basic_salary,
        (
          SELECT SUM(ess.value)
          FROM employee_salary_structure ess
          JOIN payroll_components pc ON ess.component_id = pc.id
          WHERE ess.employee_id = u.id AND pc.type = 'earning'
        ) AS gross_salary
      FROM user u
      WHERE u.id = ?;
    `, [employee_id]);

    if (
      !financials ||
      financials.basic_salary == null ||
      financials.gross_salary == null
    ) {
      return res.status(400).json({
        message:
          "Eligibility cannot be calculated. Please complete salary structure.",
      });
    }

    // 2. Compute base amounts
    const yearsOfService = DateTime.now()
      .diff(DateTime.fromJSDate(financials.joining_date), "years").years;
    const dailyGross = (financials.gross_salary * 12) / 365;

    const leaveLiability = financials.total_leave_balance * dailyGross;
    const gratuityAccrued =
      financials.basic_salary * (15 / 26) * yearsOfService;
    const baseAmount = leaveLiability + gratuityAccrued;

    // 3. Fetch loan and advance types
    const [products] = await connection.query(`
      SELECT id, name, is_advance, eligibility_percentage, interest_rate, max_tenure_months
      FROM loan_types
      WHERE is_active = TRUE;
    `);

    // 4. Calculate eligible amounts
    const eligible_products = [];
    for (const p of products) {
      if (!p.is_advance) {
        // loan: apply percentage to baseAmount
        const max_eligible = parseFloat(
          ((baseAmount * p.eligibility_percentage) / 100).toFixed(2)
        );
        eligible_products.push({
          loan_type_id: p.id,
          name: p.name,
          is_advance: false,
          interest_rate: p.interest_rate,
          max_tenure_months: p.max_tenure_months,
          max_eligible_amount: max_eligible,
        });
      } else {
        // advance: based on hours worked
        // fetch total hours worked this month
        const monthStart = DateTime.now().startOf("month").toISODate();
        const monthEnd = DateTime.now().endOf("month").toISODate();
        const [[{ total_hours }]] = await connection.query(`
          SELECT COALESCE(SUM(hours_worked),0) AS total_hours
          FROM attendance_record
          WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
        `, [employee_id, monthStart, monthEnd]);

        // rate per hour = basic_salary / scheduled_monthly_hours (approx 30 * 8)
        const ratePerHour = financials.basic_salary / (30 * 8);
        const earned = total_hours * ratePerHour;

        // apply percentage limit
        const max_eligible = parseFloat(
          ((earned * p.eligibility_percentage) / 100).toFixed(2)
        );
        eligible_products.push({
          loan_type_id: p.id,
          name: p.name,
          is_advance: true,
          interest_rate: p.interest_rate,
          max_tenure_months: p.max_tenure_months,
          hours_worked: total_hours,
          rate_per_hour: parseFloat(ratePerHour.toFixed(2)),
          max_eligible_amount: max_eligible,
        });
      }
    }

    res.status(200).json({
      eligible_base_amount: parseFloat(baseAmount.toFixed(2)),
      eligible_products,
    });
  } catch (error) {
    console.error("Error in eligibility check:", error);
    res.status(500).json({ message: "Internal server error." });
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