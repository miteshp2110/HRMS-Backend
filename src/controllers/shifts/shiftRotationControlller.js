const { pool } = require('../../db/connector');

// Create a new shift rotation schedule
exports.createRotation = async (req, res) => {
    const { rotation_name, effective_from, rotations } = req.body;
    const created_by = req.user.id;

    if (!rotation_name || !effective_from || !Array.isArray(rotations) || rotations.length === 0) {
        return res.status(400).json({ message: 'Rotation name, effective date, and a list of rotations are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [rotationResult] = await connection.query(
            'INSERT INTO shift_rotations (rotation_name, effective_from, created_by) VALUES (?, ?, ?)',
            [rotation_name, effective_from, created_by]
        );
        const rotation_id = rotationResult.insertId;

        const rotationDetails = rotations.map(r => [rotation_id, r.employee_id, r.from_shift_id, r.to_shift_id]);
        await connection.query('INSERT INTO shift_rotation_details (rotation_id, employee_id, from_shift_id, to_shift_id) VALUES ?', [rotationDetails]);
        
        await connection.query('INSERT INTO shift_rotation_audit (rotation_id, changed_by, action, details) VALUES (?, ?, ?, ?)', [rotation_id, created_by, 'CREATE', JSON.stringify(req.body)]);

        await connection.commit();
        res.status(201).json({ success: true, message: 'Shift rotation created successfully.', rotation_id });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Error creating shift rotation.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Get all shift rotation schedules
exports.getAllRotations = async (req, res) => {
    try {
        const [rotations] = await pool.query(`
            SELECT sr.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name, 
                   (SELECT COUNT(*) FROM shift_rotation_details WHERE rotation_id = sr.id) as employee_count
            FROM shift_rotations sr
            LEFT JOIN user u ON sr.created_by = u.id
            ORDER BY sr.effective_from DESC
        `);
        res.status(200).json(rotations);
    } catch (error) {
        res.status(500).json({ message: "Error fetching shift rotations.", error: error.message });
    }
};

// Get details of a single shift rotation
exports.getRotationById = async (req, res) => {
    const { rotationId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [[rotation]] = await connection.query('SELECT * FROM shift_rotations WHERE id = ?', [rotationId]);
        if (!rotation) {
            return res.status(404).json({ message: 'Shift rotation not found.' });
        }

        const [details] = await connection.query(`
            SELECT srd.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name, 
                   fs.name as from_shift_name, ts.name as to_shift_name
            FROM shift_rotation_details srd
            JOIN user u ON srd.employee_id = u.id
            JOIN shifts fs ON srd.from_shift_id = fs.id
            JOIN shifts ts ON srd.to_shift_id = ts.id
            WHERE srd.rotation_id = ?
        `, [rotationId]);
        
        const [audit] = await connection.query(`
            SELECT sra.*, CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
            FROM shift_rotation_audit sra
            LEFT JOIN user u ON sra.changed_by = u.id
            WHERE sra.rotation_id = ? ORDER BY sra.changed_at DESC
        `, [rotationId]);

        res.status(200).json({ ...rotation, details, audit });
    } catch (error) {
        res.status(500).json({ message: "Error fetching rotation details.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Update a draft shift rotation
exports.updateRotation = async (req, res) => {
    const { rotationId } = req.params;
    const { rotation_name, effective_from, rotations } = req.body;
    const changed_by = req.user.id;
    
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[rotation]] = await connection.query("SELECT * FROM shift_rotations WHERE id = ? AND status = 'Draft' FOR UPDATE", [rotationId]);
        if (!rotation) {
            await connection.rollback();
            return res.status(404).json({ message: "Draft shift rotation not found or it has already been processed." });
        }

        await connection.query('UPDATE shift_rotations SET rotation_name = ?, effective_from = ? WHERE id = ?', [rotation_name, effective_from, rotationId]);
        await connection.query('DELETE FROM shift_rotation_details WHERE rotation_id = ?', [rotationId]);

        const rotationDetails = rotations.map(r => [rotationId, r.employee_id, r.from_shift_id, r.to_shift_id]);
        await connection.query('INSERT INTO shift_rotation_details (rotation_id, employee_id, from_shift_id, to_shift_id) VALUES ?', [rotationDetails]);
        
        await connection.query('INSERT INTO shift_rotation_audit (rotation_id, changed_by, action, details) VALUES (?, ?, ?, ?)', [rotationId, changed_by, 'UPDATE', JSON.stringify(req.body)]);

        await connection.commit();
        res.status(200).json({ success: true, message: 'Shift rotation updated successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Error updating shift rotation.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Submit a draft for approval
exports.submitForApproval = async (req, res) => {
    const { rotationId } = req.params;
    const changed_by = req.user.id;
    try {
        await pool.query("UPDATE shift_rotations SET status = 'Pending Approval' WHERE id = ? AND status = 'Draft'", [rotationId]);
        await pool.query('INSERT INTO shift_rotation_audit (rotation_id, changed_by, action) VALUES (?, ?, ?)', [rotationId, changed_by, 'SUBMIT_FOR_APPROVAL']);
        res.status(200).json({ success: true, message: 'Shift rotation submitted for approval.' });
    } catch (error) {
        res.status(500).json({ message: "Error submitting for approval.", error: error.message });
    }
};

// Approve or reject a rotation
exports.processApproval = async (req, res) => {
    const { rotationId } = req.params;
    const { status } = req.body; // 'Approved' or 'Draft' (for rework)
    const approved_by = req.user.id;

    if (!['Approved', 'Draft'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        const [result] = await pool.query("UPDATE shift_rotations SET status = ?, approved_by = ? WHERE id = ? AND status = 'Pending Approval'", [status, approved_by, rotationId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Rotation not found or not pending approval." });
        }
        const action = status === 'Approved' ? 'APPROVE' : 'REJECT_FOR_REWORK';
        await pool.query('INSERT INTO shift_rotation_audit (rotation_id, changed_by, action) VALUES (?, ?, ?)', [rotationId, approved_by, action]);
        res.status(200).json({ success: true, message: `Rotation status updated to ${status}.` });
    } catch (error) {
        res.status(500).json({ message: "Error processing approval.", error: error.message });
    }
};

// Delete a draft rotation
exports.deleteRotation = async (req, res) => {
    const { rotationId } = req.params;
    try {
        const [result] = await pool.query("DELETE FROM shift_rotations WHERE id = ? AND status = 'Draft'", [rotationId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Draft shift rotation not found." });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: "Error deleting shift rotation.", error: error.message });
    }
};
