const { pool } = require('../../db/connector');

/**
 * @description [Admin] Creates a new benefit band.
 */
const createBenefitBand = async (req, res) => {
    const {
        band_name, min_years_service, max_years_service, leave_salary_calculation,
        leave_salary_percentage, lta_allowance, lta_frequency_years,
        additional_annual_leaves, medical_plan_details, education_allowance_per_child,
        fuel_allowance_monthly
    } = req.body;
    const updated_by = req.user.id;

    if (!band_name || min_years_service === undefined || max_years_service === undefined) {
        return res.status(400).json({ message: 'Band name and service year range are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            INSERT INTO benefit_bands (
                band_name, min_years_service, max_years_service, leave_salary_calculation,
                leave_salary_percentage, lta_allowance, lta_frequency_years,
                additional_annual_leaves, medical_plan_details, education_allowance_per_child,
                fuel_allowance_monthly, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        const [result] = await connection.query(sql, [
            band_name, min_years_service, max_years_service, leave_salary_calculation,
            leave_salary_percentage, lta_allowance, lta_frequency_years,
            additional_annual_leaves, medical_plan_details, education_allowance_per_child,
            fuel_allowance_monthly, updated_by
        ]);

        res.status(201).json({
            success: true,
            message: 'Benefit band created successfully.',
            bandId: result.insertId
        });
    } catch (error) {
        console.error('Error creating benefit band:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets a list of all benefit bands.
 */
const getAllBenefitBands = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [bands] = await connection.query('SELECT * FROM benefit_bands ORDER BY min_years_service ASC');
        res.status(200).json(bands);
    } catch (error) {
        console.error('Error fetching benefit bands:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Updates an existing benefit band.
 */
const updateBenefitBand = async (req, res) => {
    const { id } = req.params;
    const fieldsToUpdate = req.body;
    const updated_by = req.user.id;

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'At least one field to update is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const fieldEntries = Object.entries(fieldsToUpdate);
        const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
        const values = fieldEntries.map(([, value]) => value);
        values.push(updated_by, id);

        const sql = `UPDATE benefit_bands SET ${setClause}, updated_by = ? WHERE id = ?;`;
        const [result] = await connection.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Benefit band not found.' });
        }

        res.status(200).json({ success: true, message: 'Benefit band updated successfully.' });
    } catch (error) {
        console.error('Error updating benefit band:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createBenefitBand,
    getAllBenefitBands,
    updateBenefitBand
};