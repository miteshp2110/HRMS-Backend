const { pool } = require('../db/connector');
const { DateTime } = require('luxon');

/**
 * @description A scheduled job to apply pending salary revisions that are effective as of today.
 */
const applySalaryRevisions = async () => {
    const today = DateTime.now().toISODate();
    console.log(`[CRON JOB] Starting: Apply Salary Revisions for ${today}`);

    let connection;
    try {
        connection = await pool.getConnection();
        
        const [revisionsToApply] = await connection.query(
            "SELECT * FROM employee_salary_revisions WHERE effective_date <= ? AND status = 'Scheduled'",
            [today]
        );

        if (revisionsToApply.length === 0) {
            console.log('No salary revisions to apply today.');
            return;
        }

        console.log(`Found ${revisionsToApply.length} revision(s) to apply.`);

        for (const revision of revisionsToApply) {
            await connection.beginTransaction();
            try {
                // Upsert into the main salary structure table
                const upsertSql = `
                    INSERT INTO employee_salary_structure (
                        employee_id, component_id, calculation_type, value, 
                        based_on_component_id, custom_formula, updated_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        calculation_type = VALUES(calculation_type),
                        value = VALUES(value),
                        based_on_component_id = VALUES(based_on_component_id),
                        custom_formula = VALUES(custom_formula),
                        updated_by = VALUES(updated_by);
                `;
                await connection.query(upsertSql, [
                    revision.employee_id,
                    revision.component_id,
                    revision.new_calculation_type,
                    revision.new_value,
                    revision.new_based_on_component_id,
                    revision.new_custom_formula,
                    revision.created_by // or a system user ID
                ]);

                // Mark the revision as 'Applied'
                await connection.query(
                    "UPDATE employee_salary_revisions SET status = 'Applied', applied_by = ?, applied_at = NOW() WHERE id = ?",
                    [revision.created_by, revision.id]
                );

                await connection.commit();
                console.log(`Successfully applied revision ID: ${revision.id} for employee ID: ${revision.employee_id}`);
            } catch (error) {
                await connection.rollback();
                console.error(`Failed to apply revision ID ${revision.id}. Error:`, error);
            }
        }

    } catch (error) {
        console.error('Cron job failed:', error);
    } finally {
        if (connection) connection.release();
        if (require.main === module) {
            pool.end();
        }
    }
};

if (require.main === module) {
    applySalaryRevisions();
}

module.exports = { applySalaryRevisions };