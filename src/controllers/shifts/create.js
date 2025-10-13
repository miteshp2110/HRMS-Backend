


const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Create a new shift, converting local time to UTC.
 * @body {
 * "name": "India Day Shift",
 * "from_time_local": "09:30",
 * "to_time_local": "17:30",
 * "timezone": "Asia/Kolkata",
 * "half_day_threshold": 0.50,
 * "punch_in_margin": 15,
 * "punch_out_margin": 10
 * }
 */
const createShift = async (req, res) => {
  const {
    name,
    from_time_local,
    to_time_local,
    timezone,
    half_day_threshold,
    punch_in_margin,
    punch_out_margin,
    overtime_threshold
  } = req.body;

  if (!name || !from_time_local || !to_time_local || !timezone || !overtime_threshold) {
    return res.status(400).json({ 
      message: 'Name, from_time_local, to_time_local, and timezone are required.' 
    });
  }

  let connection;
  try {
    // 1. Convert local times to UTC using luxon
    const from_time_utc = DateTime.fromFormat(from_time_local, 'HH:mm', { zone: timezone })
      .toUTC()
      .toFormat('HH:mm:ss');
      
    const to_time_utc = DateTime.fromFormat(to_time_local, 'HH:mm', { zone: timezone })
      .toUTC()
      .toFormat('HH:mm:ss');

    // 2. Insert the UTC times and other details into the database
    connection = await pool.getConnection();
    const sql = `
      INSERT INTO shifts 
      (name, from_time, to_time, half_day_threshold, punch_in_margin, punch_out_margin,overtime_threshold) 
      VALUES (?, ?, ?, ?, ?, ?,?)
    `;
    const [result] = await connection.query(sql, [
      name,
      from_time_utc,
      to_time_utc,
      half_day_threshold || null,
      punch_in_margin || 0,
      punch_out_margin || 0,
      overtime_threshold || 0
    ]);

    res.status(201).json({
      success: true,
      message: 'Shift created successfully with times stored in UTC.',
      shift: {
        id: result.insertId,
        name,
        local_time: {
          from: from_time_local,
          to: to_time_local,
          timezone,
        },
        utc_time_stored: {
          from: from_time_utc,
          to: to_time_utc,
        },
      },
    });
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createShift };