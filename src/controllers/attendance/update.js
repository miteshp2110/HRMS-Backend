const { pool } = require('../../db/connector');

/**
 * @description [Admin] Updates attendance record with validation and salary impact calculation
 */
const updateAttendanceRecord = async (req, res) => {
  const { recordId } = req.params;
  const { 
    attendance_status,
    hours_worked, 
    short_hours,
    is_late,
    is_early_departure,
    punch_in,
    punch_out
  } = req.body;
  const updatedById = req.user.id;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Get current attendance record with employee and shift details
    const [[currentRecord]] = await connection.query(`
      SELECT 
        ar.*,
        s.scheduled_hours,
        s.name as shift_name,
        u.first_name,
        u.last_name,
        ess.value as basic_salary
      FROM attendance_record ar
      JOIN shifts s ON ar.shift = s.id
      JOIN user u ON ar.employee_id = u.id
      LEFT JOIN employee_salary_structure ess ON u.id = ess.employee_id AND ess.component_id = 1
      WHERE ar.id = ?
    `, [recordId]);

    if (!currentRecord) {
      await connection.rollback();
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    // 2. Validation rules
    const validationErrors = [];
    
    // Validate attendance_status
    if (attendance_status && !['Present', 'Absent', 'Leave', 'Half-Day'].includes(attendance_status)) {
      validationErrors.push('Invalid attendance_status. Must be Present, Absent, Leave, or Half-Day');
    }

    // Validate hours_worked against shift duration
    if (hours_worked !== undefined) {
      if (hours_worked < 0) {
        validationErrors.push('Hours worked cannot be negative');
      }
      if (hours_worked > currentRecord.scheduled_hours * 1.5) {
        validationErrors.push(`Hours worked cannot exceed ${currentRecord.scheduled_hours * 1.5} (150% of shift duration)`);
      }
    }

    // Validate short_hours
    if (short_hours !== undefined) {
      if (short_hours < 0) {
        validationErrors.push('Short hours cannot be negative');
      }
      const finalHoursWorked = hours_worked !== undefined ? hours_worked : currentRecord.hours_worked;
      if (short_hours > finalHoursWorked) {
        validationErrors.push('Short hours cannot exceed hours worked');
      }
    }

    // Validate boolean flags
    if (is_late !== undefined && typeof is_late !== 'boolean') {
      validationErrors.push('is_late must be a boolean');
    }
    if (is_early_departure !== undefined && typeof is_early_departure !== 'boolean') {
      validationErrors.push('is_early_departure must be a boolean');
    }

    // Validate timestamps
    if (punch_in && punch_out) {
      const punchInTime = new Date(punch_in);
      const punchOutTime = new Date(punch_out);
      if (punchInTime >= punchOutTime) {
        validationErrors.push('Punch out time must be after punch in time');
      }
    }

    if (validationErrors.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: validationErrors 
      });
    }

    // 3. Calculate salary impact
    const oldHoursWorked = parseFloat(currentRecord.hours_worked) || 0;
    const newHoursWorked = hours_worked !== undefined ? parseFloat(hours_worked) : oldHoursWorked;
    const hoursDifference = newHoursWorked - oldHoursWorked;

    let salaryImpact = 0;
    if (currentRecord.basic_salary && hoursDifference !== 0) {
      const dailyRate = currentRecord.basic_salary / 30; // Monthly to daily
      const hourlyRate = dailyRate / currentRecord.scheduled_hours;
      salaryImpact = hoursDifference * hourlyRate;
    }

    // 4. Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (attendance_status !== undefined) {
      updateFields.push('attendance_status = ?');
      updateValues.push(attendance_status);
    }
    if (hours_worked !== undefined) {
      updateFields.push('hours_worked = ?');
      updateValues.push(hours_worked);
    }
    if (short_hours !== undefined) {
      updateFields.push('short_hours = ?');
      updateValues.push(short_hours);
    }
    if (is_late !== undefined) {
      updateFields.push('is_late = ?');
      updateValues.push(is_late ? 1 : 0);
    }
    if (is_early_departure !== undefined) {
      updateFields.push('is_early_departure = ?');
      updateValues.push(is_early_departure ? 1 : 0);
    }
    if (punch_in !== undefined) {
      updateFields.push('punch_in = ?');
      updateValues.push(punch_in);
    }
    if (punch_out !== undefined) {
      updateFields.push('punch_out = ?');
      updateValues.push(punch_out);
    }

    // Always update updated_by
    updateFields.push('updated_by = ?');
    updateValues.push(updatedById);
    updateValues.push(recordId);

    if (updateFields.length === 1) { // Only updated_by
      await connection.rollback();
      return res.status(400).json({ message: 'No fields to update provided.' });
    }

    // 5. Execute update
    const updateSql = `
      UPDATE attendance_record 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    const [result] = await connection.query(updateSql, updateValues);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    await connection.commit();

    // 6. Return success response with impact details
    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully.',
      changes: {
        employee: `${currentRecord.first_name} ${currentRecord.last_name}`,
        date: currentRecord.attendance_date,
        shift: currentRecord.shift_name,
        hours_changed: hoursDifference !== 0 ? {
          from: oldHoursWorked,
          to: newHoursWorked,
          difference: hoursDifference
        } : null,
        salary_impact: salaryImpact !== 0 ? {
          amount: parseFloat(salaryImpact.toFixed(2)),
          description: salaryImpact > 0 ? 'Salary increase' : 'Salary decrease'
        } : null,
        updated_fields: Object.keys(req.body)
      }
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating attendance record:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports={
  updateAttendanceRecord
}