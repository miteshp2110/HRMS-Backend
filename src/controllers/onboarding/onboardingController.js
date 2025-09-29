const { pool } = require('../../db/connector');
const { uploadDocumentTOS3 } = require('../../services/s3Service');
const bcrypt = require('bcryptjs');

// --- Job Opening Functions ---

exports.createJobOpening = async (req, res) => {
    const { job_id, number_of_positions, required_skill_ids } = req.body;
    const created_by = req.user.id;

    if (!job_id || !required_skill_ids || !Array.isArray(required_skill_ids)) {
        return res.status(400).json({ message: 'job_id and an array of required_skill_ids are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.query(
            'INSERT INTO job_openings (job_id, number_of_positions, created_by) VALUES (?, ?, ?)',
            [job_id, number_of_positions, created_by]
        );
        const opening_id = result.insertId;

        if (required_skill_ids.length > 0) {
            const skillValues = required_skill_ids.map(skill_id => [opening_id, skill_id]);
            await connection.query('INSERT INTO job_opening_skills (opening_id, skill_id) VALUES ?', [skillValues]);
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Job opening created successfully.', opening_id });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Error creating job opening.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.getAllJobOpenings = async (req, res) => {
    try {
        const [openings] = await pool.query(`
            SELECT jo.id, jo.status, jo.number_of_positions, j.title as job_title, 
                   (SELECT COUNT(*) FROM applicants WHERE opening_id = jo.id) as applicant_count
            FROM job_openings jo
            JOIN jobs j ON jo.job_id = j.id
            ORDER BY jo.created_at DESC
        `);
        res.status(200).json(openings);
    } catch (error) {
        res.status(500).json({ message: "Error fetching job openings.", error: error.message });
    }
};

// --- Applicant Functions ---

exports.addApplicant = async (req, res) => {
    const { openingId } = req.params;
    const { first_name, last_name, email, phone, notes } = req.body;
    const added_by = req.user.id;

    if (!first_name || !last_name || !email || !phone || !req.file) {
        return res.status(400).json({ message: 'All fields and a resume are required.' });
    }

    try {
        const resume_url = await uploadDocumentTOS3(req.file.buffer, req.file.originalname, req.file.mimetype);

        const [result] = await pool.query(
            'INSERT INTO applicants (opening_id, first_name, last_name, email, phone, resume_url, notes, added_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [openingId, first_name, last_name, email, phone, resume_url, notes, added_by]
        );

        res.status(201).json({ success: true, message: 'Applicant added successfully.', applicant_id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This email address has already been submitted for this job opening.' });
        }
        res.status(500).json({ message: "Error adding applicant.", error: error.message });
    }
};

exports.getApplicantsForOpening = async (req, res) => {
    const { openingId } = req.params;
    try {
        const [applicants] = await pool.query('SELECT * FROM applicants WHERE opening_id = ? ORDER BY created_at DESC', [openingId]);
        res.status(200).json(applicants);
    } catch (error) {
        res.status(500).json({ message: "Error fetching applicants.", error: error.message });
    }
};

/**
 * @description Updates the status of an applicant.
 * Prevents status change if the applicant is already 'Hired'.
 */
exports.updateApplicantStatus = async (req, res) => {
    const { applicantId } = req.params;
    const { status, notes } = req.body;
    const allowedStatus = ['Interviewing', 'Approved', 'Rejected'];

    if (!status || !allowedStatus.includes(status)) {
        return res.status(400).json({ message: 'A valid status is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // **THE FIX:** Check the applicant's current status first.
        const [[applicant]] = await connection.query('SELECT status FROM applicants WHERE id = ?', [applicantId]);

        if (!applicant) {
            return res.status(404).json({ message: 'Applicant not found.' });
        }

        if (applicant.status === 'Hired') {
            return res.status(409).json({ message: 'Cannot change the status of an applicant who has already been hired.' });
        }

        // If not hired, proceed with the update.
        const [result] = await connection.query('UPDATE applicants SET status = ?, notes = ? WHERE id = ?', [status, notes, applicantId]);
        if (result.affectedRows === 0) {
            // This case is unlikely now but kept for safety.
            return res.status(404).json({ message: 'Applicant not found.' });
        }
        res.status(200).json({ success: true, message: `Applicant status updated to ${status}.` });
    } catch (error) {
        res.status(500).json({ message: "Error updating applicant status.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.convertApplicantToEmployee = async (req, res) => {
    const { applicantId } = req.params;
    const { new_employee_id, joining_date, system_role, shift } = req.body;
    const created_by = req.user.id;

    if (!new_employee_id || !joining_date || !system_role || !shift) {
        return res.status(400).json({ message: "New Employee ID, Joining Date, System Role, and Shift are required." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[applicant]] = await connection.query('SELECT * FROM applicants WHERE id = ? AND status = "Approved"', [applicantId]);
        if (!applicant) {
            await connection.rollback();
            return res.status(404).json({ message: "Approved applicant not found." });
        }
        
        const [[job_role]] = await connection.query('SELECT job_id FROM job_openings WHERE id = ?', [applicant.opening_id]);

        // Generate a temporary secure password
        const tempPassword = `welcome@${new_employee_id}`;
        const salt = await bcrypt.genSalt(8);
        const password_hash = await bcrypt.hash(tempPassword, salt);

        const [newUserResult] = await connection.query(
            `INSERT INTO user (id, first_name, last_name, email, phone, joining_date, system_role, shift, job_role, password_hash, created_by, dob, gender, emergency_contact_name, emergency_contact_relation, emergency_contact_number) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1900-01-01', 'Male', 'N/A', 'N/A', 'N/A')`, // Default values for required fields
            [new_employee_id, applicant.first_name, applicant.last_name, applicant.email, applicant.phone, joining_date, system_role, shift, job_role.job_id, password_hash, created_by]
        );

        await connection.query("UPDATE applicants SET status = 'Hired' WHERE id = ?", [applicantId]);

        await connection.commit();
        res.status(201).json({ success: true, message: 'Applicant successfully converted to employee.', user_id: newUserResult.insertId, temporary_password: tempPassword });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An employee with this ID, email, or phone number already exists.' });
        }
        res.status(500).json({ message: "Error converting applicant.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Updates the status of a job opening.
 */
exports.updateJobOpeningStatus = async (req, res) => {
    const { openingId } = req.params;
    const { status } = req.body;
    const allowedStatus = ['Open', 'Closed', 'On Hold'];

    if (!status || !allowedStatus.includes(status)) {
        return res.status(400).json({ message: `A valid status is required: ${allowedStatus.join(', ')}` });
    }

    try {
        const [result] = await pool.query(
            'UPDATE job_openings SET status = ? WHERE id = ?',
            [status, openingId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Job opening not found.' });
        }

        res.status(200).json({ success: true, message: `Job opening status updated to ${status}.` });
    } catch (error) {
        res.status(500).json({ message: "Error updating job opening status.", error: error.message });
    }
};