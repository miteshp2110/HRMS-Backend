// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// /**
//  * @description [Employee] Submits a request to encash their Annual Leave.
//  */
// const requestLeaveEncashment = async (req, res) => {
//     const { days_to_encash } = req.body;
//     const employee_id = req.user.id;
//     const annual_leave_type_id = 8; // Hardcoded as per requirement

//     let connection;
//     try {
//         connection = await pool.getConnection();

//         const [[employeeData]] = await connection.query(`
//             SELECT
//                 u.joining_date,
//                 (SELECT balance FROM employee_leave_balance WHERE employee_id = u.id AND leave_id = ?) as leave_balance,
//                 (SELECT value FROM employee_salary_structure WHERE employee_id = u.id AND component_id = 1) as basic_salary,
//                 (SELECT SUM(ess.value) FROM employee_salary_structure ess JOIN payroll_components pc ON ess.component_id = pc.id WHERE ess.employee_id = u.id AND pc.type = 'earning' AND ess.calculation_type = 'Fixed') as gross_salary
//             FROM user u WHERE u.id = ?;
//         `, [annual_leave_type_id, employee_id]);

//         if (!employeeData || !employeeData.basic_salary) {
//             return res.status(400).json({ message: "Cannot calculate amount. Salary structure is incomplete." });
//         }
//         if ((employeeData.leave_balance || 0) < days_to_encash) {
//             return res.status(400).json({ message: "Insufficient leave balance for encashment." });
//         }

//         const yearsOfService = DateTime.now().diff(DateTime.fromJSDate(employeeData.joining_date), 'years').years;
//         const [[band]] = await connection.query('SELECT * FROM benefit_bands WHERE ? >= min_years_service AND ? <= max_years_service', [yearsOfService, yearsOfService]);
        
//         const salaryBase = (band && band.leave_salary_calculation === 'Gross' && employeeData.gross_salary) ? employeeData.gross_salary : employeeData.basic_salary;
//         const percentage = (band) ? band.leave_salary_percentage / 100 : 1;
//         const dailyRate = (salaryBase * percentage * 12) / 365;
//         const calculated_amount = days_to_encash * dailyRate;

//         const sql = `
//             INSERT INTO leave_encashment_requests (employee_id, request_date, days_to_encash, calculated_amount, updated_by)
//             VALUES (?, CURDATE(), ?, ?, ?);
//         `;
//         const [result] = await connection.query(sql, [employee_id, days_to_encash, calculated_amount.toFixed(2), employee_id]);

//         res.status(201).json({ success: true, message: 'Leave encashment request submitted successfully.', encashmentId: result.insertId });

//     } catch (error) {
//         console.error('Error requesting leave encashment:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description [Manager] Approves or rejects a pending leave encashment request.
//  */
// const approveOrRejectEncashment = async (req, res) => {
//     const { id } = req.params;
//     const { status, rejection_reason } = req.body;
//     const manager_id = req.user.id;

//     if (!status || !['Approved', 'Rejected'].includes(status)) {
//         return res.status(400).json({ message: "Status must be 'Approved' or 'Rejected'." });
//     }
//     if (status === 'Rejected' && !rejection_reason) {
//         return res.status(400).json({ message: 'A rejection reason is required.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         const sql = `
//             UPDATE leave_encashment_requests
//             SET status = ?, approved_by = ?, approval_date = NOW(), rejection_reason = ?, updated_by = ?
//             WHERE id = ? AND status = 'Pending';
//         `;
//         const [result] = await connection.query(sql, [status, manager_id, rejection_reason || null, manager_id, id]);

//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Pending encashment request not found.' });
//         }

//         res.status(200).json({ success: true, message: `Leave encashment request has been ${status.toLowerCase()}.` });
//     } catch (error) {
//         console.error('Error processing encashment request:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description [HR/Finance] Disburses an approved request, deducting the leave balance.
//  */
// const disburseEncashment = async (req, res) => {
//     const { id } = req.params;
//     const { jv_number } = req.body;
//     const processed_by = req.user.id;

//     if (!jv_number) {
//         return res.status(400).json({ message: 'A JV number is required for disbursement.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         await connection.beginTransaction();

//         const [[request]] = await connection.query('SELECT * FROM leave_encashment_requests WHERE id = ? AND status = "Approved" FOR UPDATE', [id]);
//         if (!request) {
//             await connection.rollback();
//             return res.status(404).json({ message: 'Approved encashment request not found.' });
//         }
        
//         const annual_leave_type_id = 8;
//         const [[balance]] = await connection.query('SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = ? FOR UPDATE', [request.employee_id, annual_leave_type_id]);
        
//         if (!balance || parseFloat(balance.balance) < parseFloat(request.days_to_encash)) {
//             await connection.rollback();
//             return res.status(400).json({ message: "Disbursement failed. Employee no longer has sufficient leave balance."});
//         }

//         const newBalance = parseFloat(balance.balance) - parseFloat(request.days_to_encash);
//         await connection.query('UPDATE employee_leave_balance SET balance = ? WHERE employee_id = ? AND leave_id = ?', [newBalance, request.employee_id, annual_leave_type_id]);

//         await connection.query(
//             `INSERT INTO employee_leave_balance_ledger (user_id, leave_type_id, transaction_type, previous_balance, change_amount, new_balance, updated_by) VALUES (?, ?, 'encashment', ?, ?, ?, ?)`,
//             [request.employee_id, annual_leave_type_id, balance.balance, -request.days_to_encash, newBalance, processed_by]
//         );

//         await connection.query(
//             `UPDATE leave_encashment_requests SET status = 'Processed', jv_number = ?, updated_by = ? WHERE id = ?`,
//             [jv_number, processed_by, id]
//         );

//         await connection.commit();
//         res.status(200).json({ success: true, message: 'Leave encashment has been processed and disbursed.' });
//     } catch (error) {
//         if(connection) await connection.rollback();
//         console.error('Error disbursing encashment request:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description [Admin] Gets all leave encashment records with filters.
//  */
// const getAllEncashmentRecords = async (req, res) => {
//     const { employee_id, status } = req.query;
//     let connection;
//     try {
//         connection = await pool.getConnection();
//         let sql = `
//             SELECT ler.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
//             FROM leave_encashment_requests ler
//             JOIN user u ON ler.employee_id = u.id
//         `;
//         const params = [];
//         const addClause = () => params.length > 0 ? ' AND' : ' WHERE';

//         if(employee_id) {
//             sql += `${addClause()} ler.employee_id = ?`;
//             params.push(employee_id);
//         }
//         if(status) {
//             sql += `${addClause()} ler.status = ?`;
//             params.push(status);
//         }

//         sql += ' ORDER BY ler.request_date DESC;';
//         const [records] = await connection.query(sql, params);
//         res.status(200).json(records);
//     } catch (error) {
//         console.error('Error fetching all encashment records:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if(connection) connection.release();
//     }
// };

// module.exports = {
//     requestLeaveEncashment,
//     approveOrRejectEncashment,
//     disburseEncashment,
//     getAllEncashmentRecords
// };


const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description [Employee] Submits a request to encash their Annual Leave.
 */
const requestLeaveEncashment = async (req, res) => {
    const { days_to_encash, leave_type_id } = req.body;
    const employee_id = req.user.id;

    if (!days_to_encash || !leave_type_id) {
        return res.status(400).json({ message: 'days_to_encash and leave_type_id are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [[leaveType]] = await connection.query('SELECT is_encashable FROM leave_types WHERE id = ?', [leave_type_id]);

        if (!leaveType || !leaveType.is_encashable) {
            return res.status(400).json({ message: 'This leave type is not encashable.' });
        }

        const [[employeeData]] = await connection.query(`
            SELECT
                u.joining_date,
                (SELECT balance FROM employee_leave_balance WHERE employee_id = u.id AND leave_id = ?) as leave_balance,
                (SELECT value FROM employee_salary_structure WHERE employee_id = u.id AND component_id = 1) as basic_salary,
                (SELECT SUM(ess.value) FROM employee_salary_structure ess JOIN payroll_components pc ON ess.component_id = pc.id WHERE ess.employee_id = u.id AND pc.type = 'earning' AND ess.calculation_type = 'Fixed') as gross_salary
            FROM user u WHERE u.id = ?;
        `, [leave_type_id, employee_id]);

        if (!employeeData || !employeeData.basic_salary) {
            return res.status(400).json({ message: "Cannot calculate amount. Salary structure is incomplete." });
        }
        if ((employeeData.leave_balance || 0) < days_to_encash) {
            return res.status(400).json({ message: "Insufficient leave balance for encashment." });
        }

        const yearsOfService = DateTime.now().diff(DateTime.fromJSDate(employeeData.joining_date), 'years').years;
        const [[band]] = await connection.query('SELECT * FROM benefit_bands WHERE ? >= min_years_service AND ? <= max_years_service', [yearsOfService, yearsOfService]);
        
        const salaryBase = (band && band.leave_salary_calculation === 'Gross' && employeeData.gross_salary) ? employeeData.gross_salary : employeeData.basic_salary;
        const percentage = (band) ? band.leave_salary_percentage / 100 : 1;
        const dailyRate = (salaryBase * percentage * 12) / 365;
        const calculated_amount = days_to_encash * dailyRate;

        const sql = `
            INSERT INTO leave_encashment_requests (employee_id, leave_type_id, request_date, days_to_encash, calculated_amount, updated_by)
            VALUES (?, ?, CURDATE(), ?, ?, ?);
        `;
        const [result] = await connection.query(sql, [employee_id, leave_type_id, days_to_encash, calculated_amount.toFixed(2), employee_id]);

        res.status(201).json({ success: true, message: 'Leave encashment request submitted successfully.', encashmentId: result.insertId });

    } catch (error) {
        console.error('Error requesting leave encashment:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Manager] Approves or rejects a pending leave encashment request.
 */
const approveOrRejectEncashment = async (req, res) => {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const manager_id = req.user.id;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'Approved' or 'Rejected'." });
    }
    if (status === 'Rejected' && !rejection_reason) {
        return res.status(400).json({ message: 'A rejection reason is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            UPDATE leave_encashment_requests
            SET status = ?, approved_by = ?, approval_date = NOW(), rejection_reason = ?, updated_by = ?
            WHERE id = ? AND status = 'Pending';
        `;
        const [result] = await connection.query(sql, [status, manager_id, rejection_reason || null, manager_id, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending encashment request not found.' });
        }

        res.status(200).json({ success: true, message: `Leave encashment request has been ${status.toLowerCase()}.` });
    } catch (error) {
        console.error('Error processing encashment request:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [HR/Finance] Disburses an approved request, deducting the leave balance.
 */
const disburseEncashment = async (req, res) => {
    const { id } = req.params;
    const { jv_number } = req.body;
    const processed_by = req.user.id;

    if (!jv_number) {
        return res.status(400).json({ message: 'A JV number is required for disbursement.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[request]] = await connection.query('SELECT * FROM leave_encashment_requests WHERE id = ? AND status = "Approved" FOR UPDATE', [id]);
        if (!request) {
            await connection.rollback();
            return res.status(404).json({ message: 'Approved encashment request not found.' });
        }
        
        const [[balance]] = await connection.query('SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = ? FOR UPDATE', [request.employee_id, request.leave_type_id]);
        
        if (!balance || parseFloat(balance.balance) < parseFloat(request.days_to_encash)) {
            await connection.rollback();
            return res.status(400).json({ message: "Disbursement failed. Employee no longer has sufficient leave balance."});
        }

        const newBalance = parseFloat(balance.balance) - parseFloat(request.days_to_encash);
        await connection.query('UPDATE employee_leave_balance SET balance = ? WHERE employee_id = ? AND leave_id = ?', [newBalance, request.employee_id, request.leave_type_id]);

        await connection.query(
            `INSERT INTO employee_leave_balance_ledger (user_id, leave_type_id, transaction_type, previous_balance, change_amount, new_balance, updated_by) VALUES (?, ?, 'encashment', ?, ?, ?, ?)`,
            [request.employee_id, request.leave_type_id, balance.balance, -request.days_to_encash, newBalance, processed_by]
        );

        await connection.query(
            `UPDATE leave_encashment_requests SET status = 'Processed', jv_number = ?, updated_by = ? WHERE id = ?`,
            [jv_number, processed_by, id]
        );

        await connection.commit();
        res.status(200).json({ success: true, message: 'Leave encashment has been processed and disbursed.' });
    } catch (error) {
        if(connection) await connection.rollback();
        console.error('Error disbursing encashment request:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Gets all leave encashment records with filters.
 */
const getAllEncashmentRecords = async (req, res) => {
    const { employee_id, status } = req.query;
    let connection;
    try {
        connection = await pool.getConnection();
        let sql = `
            SELECT ler.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM leave_encashment_requests ler
            JOIN user u ON ler.employee_id = u.id
        `;
        const params = [];
        const addClause = () => params.length > 0 ? ' AND' : ' WHERE';

        if(employee_id) {
            sql += `${addClause()} ler.employee_id = ?`;
            params.push(employee_id);
        }
        if(status) {
            sql += `${addClause()} ler.status = ?`;
            params.push(status);
        }

        sql += ' ORDER BY ler.request_date DESC;';
        const [records] = await connection.query(sql, params);
        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching all encashment records:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if(connection) connection.release();
    }
};

module.exports = {
    requestLeaveEncashment,
    approveOrRejectEncashment,
    disburseEncashment,
    getAllEncashmentRecords
};