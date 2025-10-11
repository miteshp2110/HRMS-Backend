// const { pool } = require('../../db/connector');

// /**
//  * @description Update a shift's details.
//  */
// const updateShift = async (req, res) => {
//   const { id } = req.params;
//   const { name, from_time, to_time } = req.body;

//   if (!name && !from_time && !to_time) {
//     return res.status(400).json({ message: 'At least one field to update is required.' });
//   }
  
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     const [[existingShift]] = await connection.query('SELECT * FROM shifts WHERE id = ?', [id]);

//     if (!existingShift) {
//         return res.status(404).json({ message: 'Shift not found.' });
//     }

//     const newName = name || existingShift.name;
//     const newFromTime = from_time || existingShift.from_time;
//     const newToTime = to_time || existingShift.to_time;

//     await connection.query(
//       'UPDATE shifts SET name = ?, from_time = ?, to_time = ? WHERE id = ?',
//       [newName, newFromTime, newToTime, id]
//     );

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
 * @description Updates a shift's details, handling UTC conversion for times.
 * Only the fields that need to be changed should be sent.
 * If updating times, from_time_local, to_time_local, and timezone are all required.
 */
const updateShift = async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  console.log(body)
  if (Object.keys(body).length === 0) {
    return res.status(400).json({ message: 'At least one field to update is required.' });
  }

  const { from_time_local, to_time_local, timezone,overtime_threshold } = body;

  // Validate that if one time field is sent, all time-related fields are sent.
  if ((from_time_local || to_time_local) && (!from_time_local || !to_time_local || !timezone || !overtime_threshold)) {
    return res.status(400).json({ 
        message: 'To update shift times, from_time_local, to_time_local, and timezone are all required.' 
    });
  }

  let connection;
  try {
    const fieldsToUpdate = {};

    // Convert local times to UTC if they were provided
    if (from_time_local && to_time_local && timezone) {
      fieldsToUpdate.from_time = DateTime.fromFormat(from_time_local, 'HH:mm', { zone: timezone })
        .toUTC()
        .toFormat('HH:mm:ss');
        
      fieldsToUpdate.to_time = DateTime.fromFormat(to_time_local, 'HH:mm', { zone: timezone })
        .toUTC()
        .toFormat('HH:mm:ss');
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

    res.status(200).json({ success: true, message: 'Shift updated successfully.' });
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateShift };