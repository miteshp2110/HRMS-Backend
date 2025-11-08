

// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// /**
//  * @description Updates a shift's details, handling UTC conversion for times.
//  * Only the fields that need to be changed should be sent.
//  * If updating times, from_time_local, to_time_local, and timezone are all required.
//  */
// const updateShift = async (req, res) => {
//   const { id } = req.params;
//   const body = req.body;

//   if (Object.keys(body).length === 0) {
//     return res.status(400).json({ message: 'At least one field to update is required.' });
//   }

//   const { from_time_local, to_time_local, timezone,overtime_threshold } = body;

//   // Validate that if one time field is sent, all time-related fields are sent.
//   if ((from_time_local || to_time_local) && (!from_time_local || !to_time_local || !timezone || !overtime_threshold)) {
//     return res.status(400).json({ 
//         message: 'To update shift times, from_time_local, to_time_local, and timezone are all required.' 
//     });
//   }

//   let connection;
//   try {
//     const fieldsToUpdate = {};

//     // Convert local times to UTC if they were provided
//     if (from_time_local && to_time_local && timezone) {
//       fieldsToUpdate.from_time = DateTime.fromFormat(from_time_local, 'HH:mm', { zone: timezone })
//         .toUTC()
//         .toFormat('HH:mm:ss');
        
//       fieldsToUpdate.to_time = DateTime.fromFormat(to_time_local, 'HH:mm', { zone: timezone })
//         .toUTC()
//         .toFormat('HH:mm:ss');
//     }

//     // Add other potential fields to the update object if they exist in the request
//     ['name', 'half_day_threshold', 'punch_in_margin', 'punch_out_margin', 'overtime_threshold'].forEach(field => {
//         if (body[field] !== undefined) {
//             fieldsToUpdate[field] = body[field];
//         }
//     });

//     if (Object.keys(fieldsToUpdate).length === 0) {
//         return res.status(400).json({ message: 'No valid fields provided for update.' });
//     }

//     // Dynamically build the SQL query
//     const fieldEntries = Object.entries(fieldsToUpdate);
//     const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
//     const values = fieldEntries.map(([, value]) => value);
//     values.push(id); // Add the shift ID for the WHERE clause

//     connection = await pool.getConnection();
//     const sql = `UPDATE shifts SET ${setClause} WHERE id = ?`;
//     const [result] = await connection.query(sql, values);

//     if (result.affectedRows === 0) {
//         return res.status(404).json({ message: 'Shift not found.' });
//     }

//     res.status(200).json({ success: true, message: 'Shift updated successfully.' });
//   } catch (error) {
//     console.error('Error updating shift:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { updateShift };

const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Updates a shift's details, handling UTC conversion for times and calculating scheduled_hours.
 * Only the fields that need to be changed should be sent.
 * If updating times, from_time_local, to_time_local, and timezone are all required.
 */
const updateShift = async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  if (Object.keys(body).length === 0) {
    return res.status(400).json({ message: 'At least one field to update is required.' });
  }

  const { from_time_local, to_time_local, timezone, overtime_threshold } = body;

  // Validate that if one time field is sent, all time-related fields are sent.
  if ((from_time_local || to_time_local) && (!from_time_local || !to_time_local || !timezone || !overtime_threshold)) {
    return res.status(400).json({ 
        message: 'To update shift times, from_time_local, to_time_local, and timezone are all required.' 
    });
  }

  let connection;
  try {
    const fieldsToUpdate = {};
    let calculationInfo = null; // Store calculation info for response

    // Convert local times to UTC if they were provided
    if (from_time_local && to_time_local && timezone) {
      fieldsToUpdate.from_time = DateTime.fromFormat(from_time_local, 'HH:mm', { zone: timezone })
        .toUTC()
        .toFormat('HH:mm:ss');
        
      fieldsToUpdate.to_time = DateTime.fromFormat(to_time_local, 'HH:mm', { zone: timezone })
        .toUTC()
        .toFormat('HH:mm:ss');

      // ========== CALCULATE SCHEDULED HOURS ==========
      // Extract hour and minute components
      const [fromHour, fromMinute] = from_time_local.split(':').map(Number);
      const [toHour, toMinute] = to_time_local.split(':').map(Number);

      // Convert to total minutes
      const fromMinutes = fromHour * 60 + fromMinute;
      const toMinutes = toHour * 60 + toMinute;

      let scheduled_hours;

      if (fromMinutes < toMinutes) {
        // Same-day shift: Simple calculation
        const diffMinutes = toMinutes - fromMinutes;
        scheduled_hours = parseFloat((diffMinutes / 60).toFixed(2));
      } else {
        // Overnight shift: Add 24 hours to end time for calculation
        const diffMinutes = (toMinutes + 1440) - fromMinutes; // 1440 = 24 * 60
        scheduled_hours = parseFloat((diffMinutes / 60).toFixed(2));
      }

      // Validate scheduled hours
      if (scheduled_hours <= 0 || scheduled_hours > 24) {
        return res.status(400).json({
          message: 'Invalid shift times. Scheduled hours must be between 0 and 24.',
          calculated_hours: scheduled_hours
        });
      }

      // Add scheduled_hours to fields to update
      fieldsToUpdate.scheduled_hours = scheduled_hours;

      // Store calculation info for response
      calculationInfo = {
        local_times: {
          from: from_time_local,
          to: to_time_local,
          timezone: timezone
        },
        scheduled_hours: scheduled_hours,
        is_overnight_shift: fromMinutes > toMinutes
      };
      // ========== END: SCHEDULED HOURS CALCULATION ==========
    }

    // Add other potential fields to the update object if they exist in the request
    ['name', 'half_day_threshold', 'punch_in_margin', 'punch_out_margin', 'overtime_threshold'].forEach(field => {
        if (body[field] !== undefined) {
            fieldsToUpdate[field] = body[field];
        }
    });

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // Dynamically build the SQL query
    const fieldEntries = Object.entries(fieldsToUpdate);
    const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
    const values = fieldEntries.map(([, value]) => value);
    values.push(id); // Add the shift ID for the WHERE clause

    connection = await pool.getConnection();
    const sql = `UPDATE shifts SET ${setClause} WHERE id = ?`;
    const [result] = await connection.query(sql, values);

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Shift not found.' });
    }

    // Get updated shift details for response
    const [[updatedShift]] = await connection.query('SELECT * FROM shifts WHERE id = ?', [id]);

    // Build response
    const response = { 
      success: true, 
      message: 'Shift updated successfully.',
      shift: updatedShift
    };

    // Add calculation info if times were updated
    if (calculationInfo) {
      response.calculation = calculationInfo;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateShift };
