const { pool } = require('../../db/connector');

/**
 * @description [Admin] Performs a complex, multi-directional shift rotation for individual employees.
 * This is a transactional operation: either all valid rotations succeed, or the entire operation is rolled back.
 */
const rotateIndividualShifts = async (req, res) => {
    // Expects a body like: { "rotations": [{ "employeeId": 1, "fromShiftId": 1, "toShiftId": 2 }, ...] }
    const { rotations } = req.body;

    // --- 1. Comprehensive Input Validation ---
    if (!Array.isArray(rotations) || rotations.length === 0) {
        return res.status(400).json({ message: 'A non-empty "rotations" array is required.' });
    }
    for (const rotation of rotations) {
        if (!rotation.employeeId || !rotation.fromShiftId || !rotation.toShiftId) {
            return res.status(400).json({ message: 'Each object in the rotations array must contain employeeId, fromShiftId, and toShiftId.' });
        }
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const successfulRotations = [];
        const failedRotations = [];

        // --- 2. Process each rotation instruction individually ---
        for (const rotation of rotations) {
            const { employeeId, fromShiftId, toShiftId } = rotation;
            
            // This query is a safe update: it will only affect a row if the employee
            // exists AND is currently assigned to the expected 'from' shift.
            const updateSql = `
                UPDATE user
                SET shift = ?
                WHERE id = ? AND shift = ?;
            `;
            const [result] = await connection.query(updateSql, [toShiftId, employeeId, fromShiftId]);
            
            // --- 3. Report on the outcome of each individual update ---
            if (result.affectedRows > 0) {
                successfulRotations.push({ employeeId, from: fromShiftId, to: toShiftId });
            } else {
                failedRotations.push({ 
                    employeeId, 
                    reason: 'Employee not found or was not on the specified "from" shift.' 
                });
            }
        }
        
        // --- 4. Commit the transaction ---
        await connection.commit();

        res.status(200).json({
            success: true,
            message: 'Complex shift rotation process completed.',
            results: {
                total_instructions: rotations.length,
                successful_rotations_count: successfulRotations.length,
                failed_rotations_count: failedRotations.length,
                successes: successfulRotations,
                failures: failedRotations,
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error during complex shift rotation:', error);
        res.status(500).json({ message: 'A critical error occurred. The entire rotation has been cancelled.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { 
    rotateIndividualShifts,
    
};