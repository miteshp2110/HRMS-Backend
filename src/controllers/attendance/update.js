const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description [Admin] Updates an attendance record, automatically calculating hours and requiring a reason.
 */
const updateAttendanceRecord = async (req, res) => {
  const { recordId } = req.params;
  const { 
    attendance_status,
    is_late,
    is_early_departure,
    punch_in,
    punch_out,
    timezone, // New field for timezone context
    update_reason 
  } = req.body;
  const updatedById = req.user.id;

  if (!update_reason) {
    return res.status(400).json({ message: 'An update reason is required.' });
  }
  
  // If punch times are provided, timezone is also required.
  if ((punch_in || punch_out) && !timezone) {
    return res.status(400).json({ message: 'A timezone is required when providing punch_in or punch_out times.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[currentRecord]] = await connection.query(`
      SELECT ar.id, ar.punch_in, ar.punch_out, s.scheduled_hours
      FROM attendance_record ar
      JOIN shifts s ON ar.shift = s.id
      WHERE ar.id = ?
    `, [recordId]);

    if (!currentRecord) {
      await connection.rollback();
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    const updateFields = { ...req.body };
    delete updateFields.update_reason;
    delete updateFields.timezone; // Not a database column

    // --- Conditional Logic based on attendance_status ---
    if (attendance_status === 'Absent' || attendance_status === 'Leave') {
      updateFields.punch_in = null;
      updateFields.punch_out = null;
      updateFields.hours_worked = 0;
      updateFields.short_hours = currentRecord.scheduled_hours;
      updateFields.is_late = false;
      updateFields.is_early_departure = false;
    } else if (attendance_status === 'Present' || attendance_status === 'Half-Day' || punch_in || punch_out) {
        
        // Convert incoming local times to UTC DateTime objects
        const finalPunchIn = punch_in 
            ? DateTime.fromISO(punch_in, { zone: timezone }).toUTC() 
            : (currentRecord.punch_in ? DateTime.fromJSDate(currentRecord.punch_in, { zone: 'utc' }) : null);

        const finalPunchOut = punch_out 
            ? DateTime.fromISO(punch_out, { zone: timezone }).toUTC() 
            : (currentRecord.punch_out ? DateTime.fromJSDate(currentRecord.punch_out, { zone: 'utc' }) : null);

        if (!finalPunchIn || !finalPunchOut) {
            await connection.rollback();
            return res.status(400).json({ message: 'Validation failed', errors: ['Punch-in and punch-out times are required for "Present" or "Half-Day" status.'] });
        }

        if (finalPunchOut < finalPunchIn) {
            await connection.rollback();
            return res.status(400).json({ message: 'Validation failed', errors: ['Punch out time must be after punch in time'] });
        }

        const hoursWorked = finalPunchOut.diff(finalPunchIn, 'hours').as('hours');
        updateFields.hours_worked = parseFloat(hoursWorked.toFixed(2));
        updateFields.short_hours = Math.max(0, parseFloat(currentRecord.scheduled_hours) - updateFields.hours_worked).toFixed(2);
        
        // Update punch times with the UTC-converted values
        if(punch_in) updateFields.punch_in = finalPunchIn.toJSDate();
        if(punch_out) updateFields.punch_out = finalPunchOut.toJSDate();
    }

    const updateClauses = [];
    const updateValues = [];

    Object.entries(updateFields).forEach(([key, value]) => {
        if (value !== undefined) {
            updateClauses.push(`${key} = ?`);
            updateValues.push(value);
        }
    });
    
    if (updateClauses.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'No valid fields to update provided.' });
    }

    updateClauses.push('update_reason = ?', 'updated_by = ?');
    updateValues.push(update_reason, updatedById, recordId);

    const updateSql = `UPDATE attendance_record SET ${updateClauses.join(', ')} WHERE id = ?`;
    const [result] = await connection.query(updateSql, updateValues);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Attendance record not found or no changes made.' });
    }

    await connection.commit();

    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully.',
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating attendance record:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  updateAttendanceRecord
};