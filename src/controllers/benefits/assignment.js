const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Gets the assigned benefit band for the currently authenticated user.
 */
const getMyBenefitBand = async (req, res) => {
    const employee_id = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Get the employee's joining date
        const [[user]] = await connection.query('SELECT joining_date FROM user WHERE id = ?', [employee_id]);
        if (!user) {
            return res.status(404).json({ message: 'Employee not found.' });
        }

        // 2. Calculate years of service
        const yearsOfService = DateTime.now().diff(DateTime.fromJSDate(user.joining_date), 'years').years;

        // 3. Find the matching benefit band
        const sql = `
            SELECT * FROM benefit_bands
            WHERE ? >= min_years_service AND ? <= max_years_service;
        `;
        const [[band]] = await connection.query(sql, [yearsOfService, yearsOfService]);

        if (!band) {
            return res.status(404).json({ message: 'No applicable benefit band found for your years of service.' });
        }

        res.status(200).json({
            years_of_service: yearsOfService.toFixed(2),
            ...band
        });

    } catch (error) {
        console.error('Error fetching employee benefit band:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getMyBenefitBand
};