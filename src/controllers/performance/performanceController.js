const { pool } = require('../../db/connector');

// --- Admin: Review Cycles ---
exports.createCycle = async (req, res) => {
    const { cycle_name, start_date, end_date } = req.body;
    try {
        await pool.query('INSERT INTO performance_review_cycles (cycle_name, start_date, end_date, created_by) VALUES (?, ?, ?, ?)', [cycle_name, start_date, end_date, req.user.id]);
        res.status(201).json({ success: true, message: 'Review cycle created.' });
    } catch (error) { res.status(500).json({ message: "Error creating cycle.", error: error.message }); }
};

exports.getCycles = async (req, res) => {
    try {
        const [cycles] = await pool.query('SELECT * FROM performance_review_cycles ORDER BY start_date DESC');
        res.status(200).json(cycles);
    } catch (error) { res.status(500).json({ message: "Error fetching cycles.", error: error.message }); }
};

// --- Admin: KPI Library ---
exports.createKpi = async (req, res) => {
    const { kpi_name, description, category } = req.body;
    try {
        await pool.query('INSERT INTO kpi_library (kpi_name, description, category, created_by) VALUES (?, ?, ?, ?)', [kpi_name, description, category, req.user.id]);
        res.status(201).json({ success: true, message: 'KPI added to library.' });
    } catch (error) { res.status(500).json({ message: "Error creating KPI.", error: error.message }); }
};

exports.getKpis = async (req, res) => {
    try {
        const [kpis] = await pool.query('SELECT * FROM kpi_library ORDER BY kpi_name ASC');
        res.status(200).json(kpis);
    } catch (error) { res.status(500).json({ message: "Error fetching KPIs.", error: error.message }); }
};

// --- Manager: Goal & KPI Setting for Team ---
exports.createAppraisalsForTeam = async (req, res) => {
    const { cycle_id } = req.body;
    const manager_id = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const [team_members] = await connection.query('SELECT id FROM user WHERE reports_to = ?', [manager_id]);
        if (team_members.length === 0) {
            return res.status(404).json({ message: "You have no team members to assign appraisals to." });
        }
        for (const member of team_members) {
            await connection.query('INSERT IGNORE INTO performance_appraisals (cycle_id, employee_id) VALUES (?, ?)', [cycle_id, member.id]);
        }
        res.status(201).json({ success: true, message: 'Appraisals initiated for your team.' });
    } catch (error) {
        res.status(500).json({ message: "Error initiating appraisals.", error: error.message });
    } finally {
        if(connection) connection.release();
    }
};

exports.assignGoal = async (req, res) => {
    const { appraisal_id, goal_title, goal_description, weightage } = req.body;
    try {
        await pool.query('INSERT INTO employee_goals (appraisal_id, goal_title, goal_description, weightage) VALUES (?, ?, ?, ?)', [appraisal_id, goal_title, goal_description, weightage]);
        res.status(201).json({ success: true, message: 'Goal assigned successfully.' });
    } catch (error) { res.status(500).json({ message: "Error assigning goal.", error: error.message }); }
};

exports.assignKpi = async (req, res) => {
    const { appraisal_id, kpi_id, target, weightage } = req.body;
    try {
        await pool.query('INSERT INTO employee_kpis (appraisal_id, kpi_id, target, weightage) VALUES (?, ?, ?, ?)', [appraisal_id, kpi_id, target, weightage]);
        res.status(201).json({ success: true, message: 'KPI assigned successfully.' });
    } catch (error) { res.status(500).json({ message: "Error assigning KPI.", error: error.message }); }
};

// --- Appraisal Workflow ---
exports.getMyAppraisal = async (req, res) => {
    const { cycleId } = req.params;
    const employee_id = req.user.id;
    try {
        const [[appraisal]] = await pool.query('SELECT * FROM performance_appraisals WHERE employee_id = ? AND cycle_id = ?', [employee_id, cycleId]);
        if (!appraisal) return res.status(404).json({ message: "Appraisal not found for this cycle." });
        
        const [goals] = await pool.query('SELECT * FROM employee_goals WHERE appraisal_id = ?', [appraisal.id]);
        const [kpis] = await pool.query('SELECT ek.*, kl.kpi_name, kl.category FROM employee_kpis ek JOIN kpi_library kl ON ek.kpi_id = kl.id WHERE ek.appraisal_id = ?', [appraisal.id]);
        
        res.status(200).json({ ...appraisal, goals, kpis });
    } catch (error) { res.status(500).json({ message: "Error fetching appraisal.", error: error.message }); }
};

exports.submitSelfAssessment = async (req, res) => {
    // This function would be more complex, iterating through goals and kpis from req.body
    // For brevity, we'll just update the main status
    const { appraisalId } = req.params;
    await pool.query("UPDATE performance_appraisals SET status = 'Manager-Review' WHERE id = ? AND employee_id = ?", [appraisalId, req.user.id]);
    res.status(200).json({ success: true, message: 'Self-assessment submitted.' });
};

// ... More functions for manager assessment, etc. would go here

/**
 * @description [Manager] Gets the appraisal status for all direct reports for a given cycle.
 */
exports.getTeamAppraisalStatuses = async (req, res) => {
    const { cycleId } = req.params;
    const manager_id = req.user.id;
    try {
        const [team_appraisals] = await pool.query(`
            SELECT 
                u.id as employee_id,
                CONCAT(u.first_name, ' ', u.last_name) as employee_name,
                pa.id as appraisal_id,
                pa.status
            FROM user u
            LEFT JOIN performance_appraisals pa ON u.id = pa.employee_id AND pa.cycle_id = ?
            WHERE u.reports_to = ?
        `, [cycleId, manager_id]);
        res.status(200).json(team_appraisals);
    } catch (error) {
        res.status(500).json({ message: "Error fetching team appraisal statuses.", error: error.message });
    }
};

/**
 * @description Gets the full details of a single appraisal by its ID.
 */
exports.getAppraisalDetails = async (req, res) => {
    const { appraisalId } = req.params;
    try {
        const [[appraisal]] = await pool.query('SELECT * FROM performance_appraisals WHERE id = ?', [appraisalId]);
        if (!appraisal) return res.status(404).json({ message: "Appraisal not found." });
        
        const [goals] = await pool.query('SELECT * FROM employee_goals WHERE appraisal_id = ?', [appraisal.id]);
        const [kpis] = await pool.query('SELECT ek.*, kl.kpi_name, kl.category FROM employee_kpis ek JOIN kpi_library kl ON ek.kpi_id = kl.id WHERE ek.appraisal_id = ?', [appraisal.id]);
        
        res.status(200).json({ ...appraisal, goals, kpis });
    } catch (error) { 
        res.status(500).json({ message: "Error fetching appraisal details.", error: error.message }); 
    }
};

/**
 * @description [Manager] Submits their final assessment for an employee's appraisal.
 */
exports.submitManagerAssessment = async (req, res) => {
    const { appraisalId } = req.params;
    const { goals, kpis, final_manager_comments, overall_manager_rating } = req.body;
    const manager_id = req.user.id;

    if (!goals || !kpis || !final_manager_comments || !overall_manager_rating) {
        return res.status(400).json({ message: "All assessment fields are required." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Validate that the manager is authorized to assess this appraisal
        const [[appraisal]] = await connection.query(`
            SELECT pa.id FROM performance_appraisals pa
            JOIN user u ON pa.employee_id = u.id
            WHERE pa.id = ? AND pa.status = 'Manager-Review' AND u.reports_to = ?
        `, [appraisalId, manager_id]);

        if (!appraisal) {
            await connection.rollback();
            return res.status(403).json({ message: "Appraisal not found or you are not authorized to review it." });
        }

        // 2. Update each goal
        for (const goal of goals) {
            await connection.query(
                'UPDATE employee_goals SET manager_rating = ?, manager_comments = ? WHERE id = ? AND appraisal_id = ?',
                [goal.manager_rating, goal.manager_comments, goal.id, appraisalId]
            );
        }

        // 3. Update each KPI
        for (const kpi of kpis) {
            await connection.query(
                'UPDATE employee_kpis SET manager_rating = ?, manager_comments = ? WHERE id = ? AND appraisal_id = ?',
                [kpi.manager_rating, kpi.manager_comments, kpi.id, appraisalId]
            );
        }

        // 4. Update the main appraisal record to 'Completed'
        await connection.query(
            "UPDATE performance_appraisals SET status = 'Completed', final_manager_comments = ?, overall_manager_rating = ? WHERE id = ?",
            [final_manager_comments, overall_manager_rating, appraisalId]
        );

        await connection.commit();
        res.status(200).json({ success: true, message: 'Manager assessment has been submitted and the review is complete.' });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Error submitting manager assessment.", error: error.message });
    } finally {
        if (connection) connection.release();
    }
};