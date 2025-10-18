const { pool } = require('../../db/connector');

/**
 * @description [Admin] Schedules a new salary revision for an employee.
 */
const scheduleRevision = async (req, res) => {
    const {
        employee_id,
        component_id,
        effective_date,
        new_calculation_type,
        new_value,
        new_based_on_component_id,
        new_custom_formula,
        reason
    } = req.body;
    const created_by = req.user.id;

    if (!employee_id || !component_id || !effective_date || !new_calculation_type || new_value === undefined) {
        return res.status(400).json({ message: 'employee_id, component_id, effective_date, new_calculation_type, and new_value are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            INSERT INTO employee_salary_revisions (
                employee_id, component_id, effective_date, new_calculation_type, new_value,
                new_based_on_component_id, new_custom_formula, reason, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const [result] = await connection.query(sql, [
            employee_id, component_id, effective_date, new_calculation_type, new_value,
            new_based_on_component_id || null, new_custom_formula ? JSON.stringify(new_custom_formula) : null,
            reason, created_by
        ]);

        res.status(201).json({ success: true, message: 'Salary revision scheduled successfully.', revisionId: result.insertId });
    } catch (error) {
        console.error('Error scheduling salary revision:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Gets all salary revisions for a specific employee.
 */
const getRevisionsByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                esr.*,
                pc.name as component_name,
                CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name,
                CONCAT(applier.first_name, ' ', applier.last_name) as applied_by_name
            FROM employee_salary_revisions esr
            JOIN payroll_components pc ON esr.component_id = pc.id
            LEFT JOIN user creator ON esr.created_by = creator.id
            LEFT JOIN user applier ON esr.applied_by = applier.id
            WHERE esr.employee_id = ?
            ORDER BY esr.effective_date DESC;
        `;
        const [revisions] = await connection.query(sql, [employeeId]);
        res.status(200).json(revisions);
    } catch (error) {
        console.error('Error fetching salary revisions:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Cancels a scheduled (but not yet applied) salary revision.
 */
const cancelRevision = async (req, res) => {
    const { revisionId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query(
            "UPDATE employee_salary_revisions SET status = 'Cancelled' WHERE id = ? AND status = 'Scheduled'",
            [revisionId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Scheduled revision not found or it has already been processed.' });
        }
        res.status(200).json({ success: true, message: 'Salary revision has been cancelled.' });
    } catch (error) {
        console.error('Error cancelling salary revision:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Employee] Gets their own salary revision history and any scheduled upcoming changes.
 */
const getMySalaryRevisions = async (req, res) => {
    const employeeId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();

        // Security Check: Ensure user has salary visibility enabled
        const [[user]] = await connection.query('SELECT salary_visibility FROM user WHERE id = ?', [employeeId]);
        if (!user || !user.salary_visibility) {
            return res.status(403).json({ message: 'Access denied. Salary visibility is not enabled for your profile.' });
        }

        const sql = `
            SELECT 
                esr.id,
                esr.effective_date,
                esr.new_calculation_type,
                esr.new_value,
                esr.status,
                esr.reason,
                esr.created_at,
                esr.applied_at,
                pc.name as component_name,
                CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name
            FROM employee_salary_revisions esr
            JOIN payroll_components pc ON esr.component_id = pc.id
            LEFT JOIN user creator ON esr.created_by = creator.id
            WHERE esr.employee_id = ?
            ORDER BY esr.effective_date DESC;
        `;
        const [revisions] = await connection.query(sql, [employeeId]);
        res.status(200).json(revisions);
    } catch (error) {
        console.error('Error fetching my salary revisions:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Updates the details of a scheduled (but not yet applied) salary revision.
 */
const updateScheduledRevision = async (req, res) => {
    const { revisionId } = req.params;
    const fieldsToUpdate = req.body;
    const updated_by = req.user.id;

    // A reason for the modification is good practice for auditing
    if (!fieldsToUpdate.reason) {
        return res.status(400).json({ message: 'A reason for the update is required.' });
    }
    
    // Remove non-column fields before building the query
    const allowedFields = ['effective_date', 'new_calculation_type', 'new_value', 'new_based_on_component_id', 'new_custom_formula', 'reason'];
    
    const updateClauses = [];
    const updateValues = [];

    allowedFields.forEach(field => {
        if (fieldsToUpdate[field] !== undefined) {
            let value = fieldsToUpdate[field];
            // Stringify the custom formula if it's an object
            if (field === 'new_custom_formula' && typeof value === 'object') {
                value = JSON.stringify(value);
            }
            updateClauses.push(`${field} = ?`);
            updateValues.push(value);
        }
    });

    if (updateClauses.length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // Add the user who is making the change
    updateClauses.push('updated_by = ?');
    updateValues.push(updated_by);

    let connection;
    try {
        connection = await pool.getConnection();
        
        const updateSql = `
            UPDATE employee_salary_revisions 
            SET ${updateClauses.join(', ')} 
            WHERE id = ? AND status = 'Scheduled'
        `;
        
        const [result] = await connection.query(updateSql, [...updateValues, revisionId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Scheduled revision not found or it has already been processed.' });
        }

        res.status(200).json({ success: true, message: 'Scheduled salary revision has been updated successfully.' });
    } catch (error) {
        console.error('Error updating scheduled revision:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    scheduleRevision,
    getRevisionsByEmployee,
    cancelRevision,
    getMySalaryRevisions,
    updateScheduledRevision
};