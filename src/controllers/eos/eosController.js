
const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

// /**
//  * @description Internal function to recalculate all financial aspects of a settlement.
//  * This is the stable, core engine that now includes robust date validation to prevent errors.
//  * @param {object} connection - An active database connection.
//  * @param {number} employee_id - The ID of the employee.
//  * @param {string} last_working_date - The employee's last working date.
//  * @returns {object} An object containing all the recalculated amounts and breakdowns.
//  */
// const recalculateSettlement = async (connection, employee_id, last_working_date) => {
//     // --- 1. Fetch Fresh Data ---
//     const [[employee]] = await connection.query('SELECT joining_date, (SELECT value FROM employee_salary_structure WHERE employee_id = ? AND component_id = 1) as basic_salary FROM user WHERE id = ?', [employee_id, employee_id]);
//     if (!employee || !employee.basic_salary) {
//         throw new Error('Employee not found or basic salary not set.');
//     }

//     const [[leave_balance]] = await connection.query('SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = 8', [employee_id]);
//     const [[unpaid_leave]] = await connection.query("SELECT COUNT(*) as unpaid_days FROM attendance_record WHERE employee_id = ? AND attendance_status = 'Absent'", [employee_id]);

//     // --- 2. Perform All Calculations ---

//     // A. Leave Salary Encashment
//     const daily_basic_salary = (parseFloat(employee.basic_salary) || 0) / 30;
//     const encashable_leave_days = Math.max(0, (leave_balance ? parseFloat(leave_balance.balance) : 0) - (unpaid_leave ? unpaid_leave.unpaid_days : 0));
//     const leave_encashment_amount = daily_basic_salary * encashable_leave_days;
//     const leave_encashment_breakdown = {
//         basic_salary: employee.basic_salary,
//         daily_rate: daily_basic_salary.toFixed(2),
//         total_leave_balance: leave_balance ? parseFloat(leave_balance.balance) : 0,
//         unpaid_days_deducted: unpaid_leave ? unpaid_leave.unpaid_days : 0,
//         net_encashable_days: encashable_leave_days,
//         calculation: `(${daily_basic_salary.toFixed(2)} * ${encashable_leave_days})`
//     };

//     // B. Gratuity Calculation (With Robust Date Validation)
    
//     const startDate = DateTime.fromISO(new Date(employee.joining_date).toISOString())
//     const endDate = DateTime.fromISO(new Date(last_working_date).toISOString())
   
//     let gratuity_amount = 0;
//     let gratuity_breakdown = {};

//     // **THE FIX:** This block validates the dates before attempting any math.
//     if (!startDate.isValid || !endDate.isValid) {
        
//         gratuity_amount = 0;
//         gratuity_breakdown = {
//             service_years: "0.00",
//             basic_salary: employee.basic_salary,
//             message: "Invalid joining_date or last_working_date. Gratuity cannot be calculated.",
//             breakdown: [{ years: "0.00", rate_in_days: 0, days_payable: 0 }],
//             total_days_payable: "0.00",
//             calculation: "N/A"
//         };
//     } else {
//         const service_duration = endDate.diff(startDate, ['years', 'months']);
//         const years_of_service = (service_duration.years || 0) + ((service_duration.months || 0) / 12);
        

//         if (years_of_service < 0.5) {
//             gratuity_amount = 0;
//             gratuity_breakdown = {
//                 service_years: years_of_service.toFixed(2),
//                 basic_salary: employee.basic_salary,
//                 message: "No gratuity is payable for service less than one year.",
//                 breakdown: [{ years: years_of_service.toFixed(2), rate_in_days: 0, days_payable: 0 }],
//                 total_days_payable: "0.00",
//                 calculation: "N/A"
//             };
//         } else {
//             const daily_gratuity_rate = (parseFloat(employee.basic_salary) * 12) / 365;
//             const effective_years_for_calc = (service_duration.years || 0) + ((service_duration.months || 0) >= 6 ? 1 : (service_duration.months || 0) / 12);

//             if (effective_years_for_calc <= 5) {
//                 const days_payable = 21 * effective_years_for_calc;
//                 gratuity_amount = daily_gratuity_rate * days_payable;
//                 gratuity_breakdown = {
//                     service_years: years_of_service.toFixed(2),
//                     basic_salary: employee.basic_salary,
//                     breakdown: [{ years: effective_years_for_calc.toFixed(2), rate_in_days: 21, days_payable: days_payable.toFixed(2) }],
//                     total_days_payable: days_payable.toFixed(2),
//                     calculation: `(21 days * ${effective_years_for_calc.toFixed(2)} years) * ${daily_gratuity_rate.toFixed(2)} daily rate`
//                 };
//             } else {
//                 const first_five_years_days = 21 * 5;
//                 const remaining_years = effective_years_for_calc - 5;
//                 const remaining_years_days = 30 * remaining_years;
//                 const total_days_payable = first_five_years_days + remaining_years_days;
//                 gratuity_amount = daily_gratuity_rate * total_days_payable;
//                 gratuity_breakdown = {
//                     service_years: years_of_service.toFixed(2),
//                     basic_salary: employee.basic_salary,
//                     breakdown: [
//                         { years: 5, rate_in_days: 21, days_payable: first_five_years_days },
//                         { years: remaining_years.toFixed(2), rate_in_days: 30, days_payable: remaining_years_days.toFixed(2) }
//                     ],
//                     total_days_payable: total_days_payable.toFixed(2),
//                     calculation: `(${total_days_payable.toFixed(2)} total days) * ${daily_gratuity_rate.toFixed(2)} daily rate`
//                 };
//             }
//         }
//     }

//     // C. Loan Deduction
//     const [active_loans] = await connection.query("SELECT id, application_id_text FROM loan_applications WHERE employee_id = ? AND status = 'Disbursed'", [employee_id]);
//     let total_outstanding_loan = 0;
//     let loan_deduction_breakdown = [];
//     if (active_loans.length > 0) {
//         for (const loan of active_loans) {
//              const [[outstanding_balance]] = await connection.query(
//                 "SELECT SUM(principal_component) as outstanding FROM loan_amortization_schedule WHERE loan_application_id = ? AND status = 'Pending'",
//                 [loan.id]
//             );
//             const outstanding = parseFloat(outstanding_balance.outstanding || 0);
//             if (outstanding > 0) {
//                 total_outstanding_loan += outstanding;
//                 loan_deduction_breakdown.push({
//                     loan_id: loan.application_id_text,
//                     outstanding_principal: outstanding.toFixed(2)
//                 });
//             }
//         }
//     }

//     return {
//         leave_encashment_amount: leave_encashment_amount,
//         leave_encashment_breakdown: JSON.stringify(leave_encashment_breakdown),
//         gratuity_amount: gratuity_amount,
//         gratuity_breakdown: JSON.stringify(gratuity_breakdown),
//         loan_deduction_amount: total_outstanding_loan,
//         loan_deduction_breakdown: JSON.stringify(loan_deduction_breakdown),
//     };
// };



/**
 * @description Internal function to recalculate all financial aspects of a settlement.
 * This version is stable and includes HR Case deductions.
 * @param {object} connection - An active database connection.
 * @param {number} employee_id - The ID of the employee.
 * @param {string} last_working_date - The employee's last working date.
 * @returns {object} An object containing all the recalculated amounts and breakdowns.
 */
const recalculateSettlement = async (connection, employee_id, last_working_date) => {
    // --- 1. Fetch Fresh Data ---
    const [[employee]] = await connection.query('SELECT joining_date, (SELECT value FROM employee_salary_structure WHERE employee_id = ? AND component_id = 1) as basic_salary FROM user WHERE id = ?', [employee_id, employee_id]);
    if (!employee || !employee.basic_salary) {
        throw new Error('Employee not found or basic salary not set.');
    }

    const [[leave_balance]] = await connection.query('SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = 8', [employee_id]);
    const [[unpaid_leave]] = await connection.query("SELECT COUNT(*) as unpaid_days FROM attendance_record WHERE employee_id = ? AND attendance_status = 'Absent'", [employee_id]);

    // --- 2. Perform All Calculations ---

    // A. Leave Salary Encashment
    const daily_basic_salary = (parseFloat(employee.basic_salary) || 0) / 30;
    const encashable_leave_days = Math.max(0, (leave_balance ? parseFloat(leave_balance.balance) : 0) - (unpaid_leave ? unpaid_leave.unpaid_days : 0));
    const leave_encashment_amount = daily_basic_salary * encashable_leave_days;
    const leave_encashment_breakdown = {
        basic_salary: employee.basic_salary,
        daily_rate: daily_basic_salary.toFixed(2),
        total_leave_balance: leave_balance ? parseFloat(leave_balance.balance) : 0,
        unpaid_days_deducted: unpaid_leave ? unpaid_leave.unpaid_days : 0,
        net_encashable_days: encashable_leave_days,
        calculation: `(${daily_basic_salary.toFixed(2)} * ${encashable_leave_days})`
    };

    // B. Gratuity Calculation (Using stable date parsing)
    const startDate = DateTime.fromISO(new Date(employee.joining_date).toISOString())
    const endDate = DateTime.fromISO(new Date(last_working_date).toISOString());
    let gratuity_amount = 0;
    let gratuity_breakdown = {};

    if (!startDate.isValid || !endDate.isValid) {
        gratuity_amount = 0;
        gratuity_breakdown = {
            service_years: "0.00", basic_salary: employee.basic_salary,
            message: "Invalid joining_date or last_working_date. Gratuity cannot be calculated.",
            breakdown: [{ years: "0.00", rate_in_days: 0, days_payable: 0 }],
            total_days_payable: "0.00", calculation: "N/A"
        };
    } else {
        const service_duration = endDate.diff(startDate, ['years', 'months']);
        const years_of_service = (service_duration.years || 0) + ((service_duration.months || 0) / 12);

        if (years_of_service < 1) {
            gratuity_amount = 0;
            gratuity_breakdown = {
                service_years: years_of_service.toFixed(2), basic_salary: employee.basic_salary,
                message: "No gratuity is payable for service less than one year.",
                breakdown: [{ years: years_of_service.toFixed(2), rate_in_days: 0, days_payable: 0 }],
                total_days_payable: "0.00", calculation: "N/A"
            };
        } else {
            const daily_gratuity_rate = (parseFloat(employee.basic_salary) * 12) / 365;
            const effective_years_for_calc = (service_duration.years || 0) + ((service_duration.months || 0) >= 6 ? 1 : (service_duration.months || 0) / 12);

            if (effective_years_for_calc <= 5) {
                const days_payable = 21 * effective_years_for_calc;
                gratuity_amount = daily_gratuity_rate * days_payable;
                gratuity_breakdown = {
                    service_years: years_of_service.toFixed(2), basic_salary: employee.basic_salary,
                    breakdown: [{ years: effective_years_for_calc.toFixed(2), rate_in_days: 21, days_payable: days_payable.toFixed(2) }],
                    total_days_payable: days_payable.toFixed(2),
                    calculation: `(21 days * ${effective_years_for_calc.toFixed(2)} years) * ${daily_gratuity_rate.toFixed(2)} daily rate`
                };
            } else {
                const first_five_years_days = 21 * 5;
                const remaining_years = effective_years_for_calc - 5;
                const remaining_years_days = 30 * remaining_years;
                const total_days_payable = first_five_years_days + remaining_years_days;
                gratuity_amount = daily_gratuity_rate * total_days_payable;
                gratuity_breakdown = {
                    service_years: years_of_service.toFixed(2), basic_salary: employee.basic_salary,
                    breakdown: [
                        { years: 5, rate_in_days: 21, days_payable: first_five_years_days },
                        { years: remaining_years.toFixed(2), rate_in_days: 30, days_payable: remaining_years_days.toFixed(2) }
                    ],
                    total_days_payable: total_days_payable.toFixed(2),
                    calculation: `(${total_days_payable.toFixed(2)} total days) * ${daily_gratuity_rate.toFixed(2)} daily rate`
                };
            }
        }
    }

    // C. Loan Deduction
    const [active_loans] = await connection.query("SELECT id, application_id_text FROM loan_applications WHERE employee_id = ? AND status = 'Disbursed'", [employee_id]);
    let total_outstanding_loan = 0;
    let loan_deduction_breakdown = [];
    if (active_loans.length > 0) {
        for (const loan of active_loans) {
             const [[outstanding_balance]] = await connection.query(
                "SELECT SUM(principal_component) as outstanding FROM loan_amortization_schedule WHERE loan_application_id = ? AND status = 'Pending'",
                [loan.id]
            );
            const outstanding = parseFloat(outstanding_balance.outstanding || 0);
            if (outstanding > 0) {
                total_outstanding_loan += outstanding;
                loan_deduction_breakdown.push({
                    loan_id: loan.application_id_text,
                    outstanding_principal: outstanding.toFixed(2)
                });
            }
        }
    }

    // D. HR Case Deductions (NEW)
    const [approved_cases] = await connection.query(
        "SELECT id, case_id_text, title, deduction_amount FROM hr_cases WHERE employee_id = ? AND status = 'Approved' ",
        [employee_id]
    );
    let total_case_deductions = 0;
    let case_deduction_breakdown = [];
    if (approved_cases.length > 0) {
        for (const aCase of approved_cases) {
            const deductionAmount = parseFloat(aCase.deduction_amount || 0);
            if (deductionAmount > 0) {
                total_case_deductions += deductionAmount;
                case_deduction_breakdown.push({
                    case_id: aCase.case_id_text,
                    title: aCase.title,
                    amount: deductionAmount.toFixed(2)
                });
            }
        }
    }
    

    return {
        leave_encashment_amount,
        leave_encashment_breakdown: JSON.stringify(leave_encashment_breakdown),
        gratuity_amount,
        gratuity_breakdown: JSON.stringify(gratuity_breakdown),
        loan_deduction_amount: total_outstanding_loan,
        loan_deduction_breakdown: JSON.stringify(loan_deduction_breakdown),
        case_deduction_amount: total_case_deductions,
        case_deduction_breakdown: JSON.stringify(case_deduction_breakdown),
    };
};


// --- CONTROLLER FUNCTIONS ---

// const initiateSettlement = async (req, res) => {
//     const { employee_id, termination_type, last_working_date, termination_reason, notes } = req.body;
//     const initiated_by = req.user.id;

//     if (!employee_id || !termination_type || !last_working_date) {
//         return res.status(400).json({ message: 'Employee, termination type, and last working date are required.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         await connection.beginTransaction();

//         const calculated = await recalculateSettlement(connection, employee_id, last_working_date);

//         const total_additions = calculated.leave_encashment_amount + calculated.gratuity_amount;
//         const total_deductions = calculated.loan_deduction_amount;
//         const net_settlement_amount = total_additions - total_deductions;

//         const insertSql = `
//             INSERT INTO final_settlements (
//                 employee_id, last_working_date, termination_type, termination_reason, notes,
//                 leave_encashment_amount, leave_encashment_breakdown,
//                 gratuity_amount, gratuity_breakdown,
//                 loan_deduction_amount, loan_deduction_breakdown,
//                 total_additions, total_deductions, net_settlement_amount, initiated_by
//             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
//         `;
//         await connection.query(insertSql, [
//             employee_id, last_working_date, termination_type, termination_reason, notes,
//             calculated.leave_encashment_amount.toFixed(2), calculated.leave_encashment_breakdown,
//             calculated.gratuity_amount.toFixed(2), calculated.gratuity_breakdown,
//             calculated.loan_deduction_amount.toFixed(2), calculated.loan_deduction_breakdown,
//             total_additions.toFixed(2), total_deductions.toFixed(2), net_settlement_amount.toFixed(2), initiated_by
//         ]);

//         await connection.commit();
//         res.status(201).json({ success: true, message: 'End-of-Service settlement initiated successfully.' });

//     } catch (error) {
//         if (connection) await connection.rollback();
//         console.error('Error initiating settlement:', error.message);
//         res.status(500).json({ message: error.message });
//     } finally {
//         if (connection) connection.release();
//     }
// };



const initiateSettlement = async (req, res) => {
    // This function remains largely the same, but now it receives more data from recalculateSettlement
    const { employee_id, termination_type, last_working_date, termination_reason, notes } = req.body;
    const initiated_by = req.user.id;
    if (!employee_id || !termination_type || !last_working_date) { return res.status(400).json({ message: 'Employee, termination type, and last working date are required.' }); }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const calculated = await recalculateSettlement(connection, employee_id, last_working_date);
        const total_additions = calculated.leave_encashment_amount + calculated.gratuity_amount;
        const total_deductions = calculated.loan_deduction_amount + calculated.case_deduction_amount;
        const net_settlement_amount = total_additions - total_deductions;
        const insertSql = `
            INSERT INTO final_settlements (
                employee_id, last_working_date, termination_type, termination_reason, notes,
                leave_encashment_amount, leave_encashment_breakdown,
                gratuity_amount, gratuity_breakdown,
                loan_deduction_amount, loan_deduction_breakdown,
                case_deduction_amount,case_deduction_breakdown,
                total_additions, total_deductions, net_settlement_amount, initiated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?);
        `;
        await connection.query(insertSql, [
            employee_id, last_working_date, termination_type, termination_reason, notes,
            calculated.leave_encashment_amount.toFixed(2), calculated.leave_encashment_breakdown,
            calculated.gratuity_amount.toFixed(2), calculated.gratuity_breakdown,
            calculated.loan_deduction_amount.toFixed(2), calculated.loan_deduction_breakdown,
            calculated.case_deduction_amount,
            calculated.case_deduction_breakdown,
            total_additions.toFixed(2), total_deductions.toFixed(2), net_settlement_amount.toFixed(2), initiated_by
        ]);
        await connection.commit();
        res.status(201).json({ success: true, message: 'End-of-Service settlement initiated successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error initiating settlement:', error);
        res.status(500).json({ message: error.message });
    } finally {
        if (connection) connection.release();
    }
};

const getSettlementDetails = async (req, res) => {
    const { settlementId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[settlement]] = await connection.query('SELECT * FROM final_settlements WHERE id = ? FOR UPDATE', [settlementId]);
        if (!settlement) {
            await connection.rollback();
            return res.status(404).json({ message: 'Settlement not found.' });
        }

        if (settlement.status === 'Pending') {
            const calculated = await recalculateSettlement(connection, settlement.employee_id, settlement.last_working_date);
            
            const other_deductions = parseFloat(settlement.other_deductions) || 0;
            const total_additions = calculated.leave_encashment_amount + calculated.gratuity_amount;
            const total_deductions = calculated.loan_deduction_amount + other_deductions + calculated.case_deduction_amount;
            const net_settlement_amount = total_additions - total_deductions;

            await connection.query(`
                UPDATE final_settlements SET
                    leave_encashment_amount = ?, leave_encashment_breakdown = ?,
                    gratuity_amount = ?, gratuity_breakdown = ?,
                    loan_deduction_amount = ?, loan_deduction_breakdown = ?,

                    total_additions = ?, total_deductions = ?, net_settlement_amount = ?,case_deduction_breakdown=?,case_deduction_amount=?
                WHERE id = ?
            `, [
                calculated.leave_encashment_amount.toFixed(2), calculated.leave_encashment_breakdown,
                calculated.gratuity_amount.toFixed(2), calculated.gratuity_breakdown,
                calculated.loan_deduction_amount.toFixed(2), calculated.loan_deduction_breakdown,
                total_additions.toFixed(2), total_deductions.toFixed(2), net_settlement_amount.toFixed(2),
                calculated.case_deduction_breakdown,calculated.case_deduction_amount.toFixed(2),
                settlementId
            ]);
        }

        const [[finalSettlement]] = await connection.query(`
            SELECT fs.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM final_settlements fs JOIN user u ON fs.employee_id = u.id
            WHERE fs.id = ?;
        `, [settlementId]);

        await connection.commit();

        finalSettlement.leave_encashment_breakdown = JSON.parse(finalSettlement.leave_encashment_breakdown || '{}');
        finalSettlement.gratuity_breakdown = JSON.parse(finalSettlement.gratuity_breakdown || '{}');
        finalSettlement.loan_deduction_breakdown = JSON.parse(finalSettlement.loan_deduction_breakdown || '[]');
        finalSettlement.case_deduction_breakdown = JSON.parse(finalSettlement.case_deduction_breakdown || '[]');

        res.status(200).json(finalSettlement);
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error getting settlement details:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

const getAllSettlements = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        
        const [settlements] = await connection.query(`
            SELECT fs.id, fs.employee_id, fs.last_working_date, fs.status,
                   CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM final_settlements fs
            JOIN user u ON fs.employee_id = u.id
            ORDER BY fs.created_at DESC
        `);

        for (const settlement of settlements) {
            if (settlement.status === 'Pending') {
                try {
                    const calculated = await recalculateSettlement(connection, settlement.employee_id, settlement.last_working_date);
                    const [[existing_other_deductions]] = await connection.query('SELECT other_deductions FROM final_settlements WHERE id = ?', [settlement.id]);
                    const other_deductions = parseFloat(existing_other_deductions.other_deductions || 0);

                    const total_additions = calculated.leave_encashment_amount + calculated.gratuity_amount;
                    const total_deductions = calculated.loan_deduction_amount + other_deductions + calculated.case_deduction_amount;
                    const net_settlement_amount = total_additions - total_deductions;

                    await connection.query(`
                        UPDATE final_settlements SET
                            leave_encashment_amount = ?, gratuity_amount = ?, loan_deduction_amount = ?,
                            total_additions = ?, total_deductions = ?, net_settlement_amount = ?,
                             case_deduction_amount=?
                        WHERE id = ?
                    `, [
                        calculated.leave_encashment_amount.toFixed(2), calculated.gratuity_amount.toFixed(2), calculated.loan_deduction_amount.toFixed(2),
                        total_additions.toFixed(2), total_deductions.toFixed(2), net_settlement_amount.toFixed(2),calculated.case_deduction_amount,
                        settlement.id
                    ]);
                } catch (recalcError) {
                    console.error(`Could not recalculate for settlement ID ${settlement.id}:`, recalcError.message);
                }
            }
        }

        const [final_settlements] = await connection.query(`
            SELECT fs.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM final_settlements fs
            JOIN user u ON fs.employee_id = u.id
            ORDER BY fs.created_at DESC
        `);
        
        res.status(200).json(final_settlements);
    } catch (error) {
        console.error('Error getting all settlements:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

const updateSettlementDeductions = async (req, res) => {
    const { settlementId } = req.params;
    const { other_deductions } = req.body; // loan_deduction_amount is no longer needed here
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Fetch the auto-calculated loan amount and total additions
        const [[settlement]] = await connection.query('SELECT total_additions, loan_deduction_amount,case_deduction_amount FROM final_settlements WHERE id = ? FOR UPDATE', [settlementId]);
        if (!settlement) {
            await connection.rollback();
            return res.status(404).json({ message: 'Settlement not found.' });
        }
        
        const total_deductions = (parseFloat(settlement.loan_deduction_amount) || 0) + (parseFloat(other_deductions) || 0) +  (parseFloat(settlement.case_deduction_amount) || 0) ;
        const net_settlement_amount = parseFloat(settlement.total_additions) - total_deductions;
        
        await connection.query(
            'UPDATE final_settlements SET other_deductions = ?, total_deductions = ?, net_settlement_amount = ? WHERE id = ?',
            [other_deductions, total_deductions.toFixed(2), net_settlement_amount.toFixed(2), settlementId]
        );
        
        await connection.commit();
        res.status(200).json({ success: true, message: 'Deductions updated successfully.' });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating deductions:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

const approveSettlement = async (req, res) => {
    const { settlementId } = req.params;
    const approved_by = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            "UPDATE final_settlements SET status = 'Approved', approved_by = ? WHERE id = ? AND status = 'Pending'",
            [approved_by, settlementId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending settlement not found.' });
        }
        res.status(200).json({ success: true, message: 'Settlement approved.' });
    } catch (error) {
        console.error('Error approving settlement:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Finance] Records the payment for a settlement and deactivates the user.
 */
const recordPayment = async (req, res) => {
    const { settlementId } = req.params;
    const { jv_number } = req.body;
    const inactivated_by = req.user.id;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Update the settlement status to 'Paid'
        const [settlementResult] = await connection.query(
            "UPDATE final_settlements SET status = 'Paid', jv_number = ? WHERE id = ? AND status = 'Approved'",
            [jv_number, settlementId]
        );

        if (settlementResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Approved settlement not found.' });
        }

        // 2. Get the employee ID from the settlement record
        const [[settlement]] = await connection.query("SELECT employee_id, termination_reason FROM final_settlements WHERE id = ?", [settlementId]);
        const employeeId = settlement.employee_id;
        const reason = settlement.termination_reason || 'End of Service settlement paid.';

        // 3. Deactivate the user account
        await connection.query(
            `UPDATE user SET is_active = FALSE, inactive_date = NOW(), inactivated_by = ?, inactive_reason = ? WHERE id = ?`,
            [inactivated_by, reason, employeeId]
        );

        await connection.commit();
        res.status(200).json({ success: true, message: 'Payment recorded and user has been deactivated.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error recording payment:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Deletes a settlement record, only if it's in 'Pending' status.
 */
const deleteSettlement = async (req, res) => {
    const { settlementId } = req.params;
    const permissions = req.user.permissions
    
    let connection;

    try {
        connection = await pool.getConnection();
        let deleteQuery = "DELETE FROM final_settlements WHERE id = ? AND status = 'Pending'"
        if(permissions.includes('master.key')){
            deleteQuery = "DELETE FROM final_settlements WHERE id = ?"
        }
        const [result] = await connection.query(
            deleteQuery,
            [settlementId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending settlement not found or you dont have permissions to delete it' });
        }

        res.status(204).send(); // Success with no content
    } catch (error) {
        console.error('Error deleting settlement:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};
module.exports = {
    initiateSettlement,
    getSettlementDetails,
    updateSettlementDeductions,
    approveSettlement,
    recordPayment,
    getAllSettlements,
    deleteSettlement
};