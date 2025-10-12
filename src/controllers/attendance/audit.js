// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// // Helper function to format snake_case field names into Title Case
// const formatFieldName = (fieldName) => {
//     if (!fieldName) return 'Unknown Field';
//     if (fieldName === 'Bulk Punch') return 'Bulk Update'; // Special case for bulk actions
//     return fieldName
//         .split('_')
//         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//         .join(' ');
// };

// // Helper function to format different types of values from the audit log
// const formatValue = (fieldName, value) => {
//     if (value === null || value === undefined) return 'N/A';

//     // Format timestamps
//     if (fieldName === 'punch_in' || fieldName === 'punch_out') {
//         try {
//             return DateTime.fromJSDate(new Date(value)).toFormat('dd LLL yyyy, hh:mm a');
//         } catch (e) {
//             return value; // Return original if parsing fails
//         }
//     }
    
//     // Format boolean-like values
//     if (fieldName === 'is_late' || fieldName === 'is_early_departure') {
//         return (value === '1' || value === 1 || value === true) ? 'Yes' : 'No';
//     }

//     // For bulk punch, the value is a JSON string
//     if (fieldName === 'Bulk Punch') {
//         try {
//             const bulkData = JSON.parse(value);
//             return `Bulk update with Punch In: ${bulkData.punch_in_local || 'N/A'}, Punch Out: ${bulkData.punch_out_local || 'N/A'}`;
//         } catch (e) {
//             return 'Bulk Update';
//         }
//     }

//     return value; // Return original value for other fields
// };


// /**
//  * @description Gets the formatted audit history for a specific attendance record.
//  */
// const getAttendanceAuditHistory = async (req, res) => {
//   const { recordId } = req.params;
//   let connection;

//   try {
//     connection = await pool.getConnection();
//     const sql = `
//       SELECT
//         aa.id,
//         aa.field_name,
//         aa.old_value,
//         aa.new_value,
//         aa.changed_at,
//         CONCAT(u.first_name, ' ', u.last_name) as changed_by_name,
//         aa.bulk_log_id
//       FROM attendance_audit_log aa
//       LEFT JOIN user u ON aa.changed_by = u.id
//       WHERE aa.attendance_id = ?
//       ORDER BY aa.changed_at DESC;
//     `;
//     const [auditHistory] = await connection.query(sql, [recordId]);

//     if (auditHistory.length === 0) {
//       return res.status(200).json([]);
//     }

//     // --- Data Formatting ---
//     const formattedHistory = auditHistory.map(record => {
//         const fieldName = record.field_name;
        
//         return {
//             id: record.id,
//             fieldChanged: formatFieldName(fieldName),
//             oldValue: formatValue(fieldName, record.old_value),
//             newValue: formatValue(fieldName, record.new_value),
//             changedAt: DateTime.fromJSDate(record.changed_at).toFormat('dd LLL yyyy, hh:mm a'),
//             changedBy: record.changed_by_name || 'System',
//             isBulkUpdate: !!record.bulk_log_id,
//         };
//     });

//     res.status(200).json(formattedHistory);
//   } catch (error) {
//     console.error(`Error fetching audit history for attendance record ${recordId}:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// /**
//  * @description Gets the audit history for a specific overtime record.
//  */
// const getOvertimeAuditHistory = async (req, res) => {
//     // This function can also be enhanced with similar formatting if needed.
//     // For now, it remains as is.
//     const { overtimeRecordId } = req.params;
//     let connection;

//     try {
//         connection = await pool.getConnection();
//         const sql = `
//             SELECT
//                 eoa.id,
//                 eoa.field_name,
//                 eoa.old_value,
//                 eoa.new_value,
//                 eoa.changed_at,
//                 eoa.changed_by AS changed_by_id,
//                 CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
//             FROM employee_overtime_audit_log eoa
//             LEFT JOIN user u ON eoa.changed_by = u.id
//             WHERE eoa.overtime_record_id = ?
//             ORDER BY eoa.changed_at DESC;
//         `;
//         const [auditHistory] = await connection.query(sql, [overtimeRecordId]);

//         res.status(200).json(auditHistory);
//     } catch (error) {
//         console.error(`Error fetching audit history for overtime record ${overtimeRecordId}:`, error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// module.exports = {
//     getAttendanceAuditHistory,
//     getOvertimeAuditHistory
// };


const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

// Helper function to format snake_case field names into Title Case
const formatFieldName = (fieldName) => {
    if (!fieldName) return 'Unknown Field';
    if (fieldName === 'Bulk Punch') return 'Bulk Update'; // Special case for bulk actions
    return fieldName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Helper function to format different types of values from the audit log
const formatValue = (fieldName, value) => {
    if (value === null || value === undefined) return 'N/A';

    // Format timestamps
    if (fieldName === 'punch_in' || fieldName === 'punch_out') {
        try {
            return DateTime.fromJSDate(new Date(value)).toFormat('dd LLL yyyy, hh:mm a');
        } catch (e) {
            return value; // Return original if parsing fails
        }
    }
    
    // Format boolean-like values
    if (fieldName === 'is_late' || fieldName === 'is_early_departure') {
        return (value === '1' || value === 1 || value === true) ? 'Yes' : 'No';
    }

    // For bulk punch, the value is a JSON string
    if (fieldName === 'Bulk Punch') {
        try {
            const bulkData = JSON.parse(value);
            return `Bulk update with Punch In: ${bulkData.punch_in_local || 'N/A'}, Punch Out: ${bulkData.punch_out_local || 'N/A'}`;
        } catch (e) {
            return 'Bulk Update';
        }
    }

    return value; // Return original value for other fields
};


/**
 * @description Gets the formatted audit history for a specific attendance record.
 */
const getAttendanceAuditHistory = async (req, res) => {
  const { recordId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT
        aa.id,
        aa.field_name,
        aa.old_value,
        aa.new_value,
        aa.changed_at,
        CONCAT(u.first_name, ' ', u.last_name) as changed_by_name,
        aa.bulk_log_id
      FROM attendance_audit_log aa
      LEFT JOIN user u ON aa.changed_by = u.id
      WHERE aa.attendance_id = ?
      ORDER BY aa.changed_at DESC;
    `;
    const [auditHistory] = await connection.query(sql, [recordId]);

    if (auditHistory.length === 0) {
      return res.status(200).json([]);
    }

    // --- Data Formatting ---
    const formattedHistory = auditHistory.map(record => {
        const fieldName = record.field_name;
        
        return {
            id: record.id,
            fieldChanged: formatFieldName(fieldName),
            oldValue: formatValue(fieldName, record.old_value),
            newValue: formatValue(fieldName, record.new_value),
            changedAt: record.changed_at, // Return raw timestamp string from DB
            changedBy: record.changed_by_name || 'System',
            isBulkUpdate: !!record.bulk_log_id,
        };
    });

    res.status(200).json(formattedHistory);
  } catch (error) {
    console.error(`Error fetching audit history for attendance record ${recordId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets the audit history for a specific overtime record.
 */
const getOvertimeAuditHistory = async (req, res) => {
    const { overtimeRecordId } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                eoa.id,
                eoa.field_name,
                eoa.old_value,
                eoa.new_value,
                eoa.changed_at,
                eoa.changed_by AS changed_by_id,
                CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
            FROM employee_overtime_audit_log eoa
            LEFT JOIN user u ON eoa.changed_by = u.id
            WHERE eoa.overtime_record_id = ?
            ORDER BY eoa.changed_at DESC;
        `;
        const [auditHistory] = await connection.query(sql, [overtimeRecordId]);

        res.status(200).json(auditHistory);
    } catch (error) {
        console.error(`Error fetching audit history for overtime record ${overtimeRecordId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getAttendanceAuditHistory,
    getOvertimeAuditHistory
};