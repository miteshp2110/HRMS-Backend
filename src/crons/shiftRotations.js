const { pool } = require('../db/connector');
const { DateTime } = require('luxon');

const applyShiftRotations = async () => {
    const today = DateTime.now().toISODate();
    console.log(`[${new Date().toISOString()}] Running cron job: Apply Shift Rotations for ${today}`);

    let connection;
    try {
        connection = await pool.getConnection();
        
        const [rotationsToApply] = await connection.query(
            "SELECT * FROM shift_rotations WHERE effective_from = ? AND status = 'Approved'",
            [today]
        );

        if (rotationsToApply.length === 0) {
            console.log('No shift rotations to apply today.');
            return;
        }

        for (const rotation of rotationsToApply) {
            await connection.beginTransaction();
            try {
                const [details] = await connection.query('SELECT * FROM shift_rotation_details WHERE rotation_id = ?', [rotation.id]);
                
                for (const detail of details) {
                    await connection.query('UPDATE user SET shift = ? WHERE id = ?', [detail.to_shift_id, detail.employee_id]);
                }

                await connection.query("UPDATE shift_rotations SET status = 'Executed' WHERE id = ?", [rotation.id]);
                await connection.query('INSERT INTO shift_rotation_audit (rotation_id, action) VALUES (?, ?)', [rotation.id, 'CRON_EXECUTE']);

                await connection.commit();
                console.log(`Successfully applied shift rotation ID: ${rotation.id}`);
            } catch (error) {
                await connection.rollback();
                console.error(`Error applying rotation ID ${rotation.id}:`, error);
            }
        }
    } catch (error) {
        console.error('Cron job failed:', error);
    } finally {
        if (connection) connection.release();
        // If running as a standalone script, end the pool
        if (require.main === module) {
            pool.end();
        }
    }
};

// This allows running the script directly
if (require.main === module) {
    applyShiftRotations();
}

module.exports = { applyShiftRotations };
