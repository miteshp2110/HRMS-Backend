// const { pool } = require('../../db/connector');

// /**
//  * @description Gets the audit history for a specific user.
//  */
// const getUserAuditHistory = async (req, res) => {
//   const { userId } = req.params;
//   let connection;

//   try {
//     connection = await pool.getConnection();
//     const sql = `
//       SELECT
//         ua.audit_id,
//         ua.field_changed,
//         ua.old_value,
//         ua.new_value,
//         ua.updated_at,
//         ua.updated_by,
//         CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
//       FROM user_audit ua
//       LEFT JOIN user u ON ua.updated_by = u.id
//       WHERE ua.user_id = ?
//       ORDER BY ua.updated_at DESC;
//     `;
//     const [auditHistory] = await connection.query(sql, [userId]);

//     if (auditHistory.length === 0) {
//       // It's not an error if a user has no audit history, so we return an empty array.
//       return res.status(200).json([]);
//     }

//     res.status(200).json(auditHistory);
//   } catch (error) {
//     console.error(`Error fetching audit history for user ${userId}:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { getUserAuditHistory };

const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

// Helper function to format snake_case field names into Title Case
const formatFieldName = (fieldName) => {
    if (!fieldName) return 'Unknown Field';
    return fieldName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Helper function to format boolean-like values from the database (0 or 1)
const formatBooleanValue = (value) => {
    if (value === '1' || value === 1 || value === true) return 'Yes';
    if (value === '0' || value === 0 || value === false) return 'No';
    return value; // Return original value if it's not a clear boolean
};


/**
 * @description Gets the formatted audit history for a specific user.
 */
const getUserAuditHistory = async (req, res) => {
  const { userId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT
        ua.audit_id,
        ua.field_changed,
        ua.old_value,
        ua.new_value,
        ua.updated_at,
        ua.updated_by,
        CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
      FROM user_audit ua
      LEFT JOIN user u ON ua.updated_by = u.id
      WHERE ua.user_id = ?
      ORDER BY ua.updated_at DESC;
    `;
    const [auditHistory] = await connection.query(sql, [userId]);

    if (auditHistory.length === 0) {
      return res.status(200).json([]);
    }

    // --- Data Formatting ---

    // 1. Collect all foreign key IDs that need to be resolved to names
    const idsToResolve = {
        roles: new Set(),
        jobs: new Set(),
        shifts: new Set(),
        users: new Set()
    };

    auditHistory.forEach(record => {
        const oldValue = record.old_value;
        const newValue = record.new_value;

        switch (record.field_changed) {
            case 'system_role':
                if (oldValue) idsToResolve.roles.add(oldValue);
                if (newValue) idsToResolve.roles.add(newValue);
                break;
            case 'job_role':
                if (oldValue) idsToResolve.jobs.add(oldValue);
                if (newValue) idsToResolve.jobs.add(newValue);
                break;
            case 'shift':
                if (oldValue) idsToResolve.shifts.add(oldValue);
                if (newValue) idsToResolve.shifts.add(newValue);
                break;
            case 'reports_to':
            case 'inactivated_by':
                if (oldValue) idsToResolve.users.add(oldValue);
                if (newValue) idsToResolve.users.add(newValue);
                break;
        }
    });

    // 2. Fetch the names for all collected IDs in parallel for efficiency
    const [
        [roleResults],
        [jobResults],
        [shiftResults],
        [userResults]
    ] = await Promise.all([
        idsToResolve.roles.size > 0 ? connection.query('SELECT id, name FROM roles WHERE id IN (?)', [[...idsToResolve.roles]]) : Promise.resolve([[]]),
        idsToResolve.jobs.size > 0 ? connection.query('SELECT id, title as name FROM jobs WHERE id IN (?)', [[...idsToResolve.jobs]]) : Promise.resolve([[]]),
        idsToResolve.shifts.size > 0 ? connection.query('SELECT id, name FROM shifts WHERE id IN (?)', [[...idsToResolve.shifts]]) : Promise.resolve([[]]),
        idsToResolve.users.size > 0 ? connection.query("SELECT id, CONCAT(first_name, ' ', last_name) as name FROM user WHERE id IN (?)", [[...idsToResolve.users]]) : Promise.resolve([[]]),
    ]);

    // 3. Create Maps for quick lookups
    const roleMap = new Map(roleResults.map(r => [r.id.toString(), r.name]));
    const jobMap = new Map(jobResults.map(j => [j.id.toString(), j.name]));
    const shiftMap = new Map(shiftResults.map(s => [s.id.toString(), s.name]));
    const userMap = new Map(userResults.map(u => [u.id.toString(), u.name]));


    // 4. Transform the raw audit history into the final, user-friendly format
    const formattedHistory = auditHistory.map(record => {
        let oldValue = record.old_value;
        let newValue = record.new_value;

        // Resolve IDs to names where applicable
        switch (record.field_changed) {
            case 'system_role':
                oldValue = roleMap.get(oldValue) || oldValue;
                newValue = roleMap.get(newValue) || newValue;
                break;
            case 'job_role':
                oldValue = jobMap.get(oldValue) || oldValue;
                newValue = jobMap.get(newValue) || newValue;
                break;
            case 'shift':
                oldValue = shiftMap.get(oldValue) || oldValue;
                newValue = shiftMap.get(newValue) || newValue;
                break;
            case 'reports_to':
            case 'inactivated_by':
                oldValue = userMap.get(oldValue) || oldValue;
                newValue = userMap.get(newValue) || newValue;
                break;
            case 'is_active':
            case 'is_probation':
            case 'salary_visibility':
            case 'is_payroll_exempt':
            case 'is_signed':
                oldValue = formatBooleanValue(oldValue);
                newValue = formatBooleanValue(newValue);
                break;
        }

        return {
            audit_id: record.audit_id,
            field_changed: formatFieldName(record.field_changed),
            old_value: oldValue || 'N/A',
            new_value: newValue || 'N/A',
            updated_at: record.updated_at,
            updated_by_name: record.updated_by_name || 'System',
            updated_by:record.updated_by
        };
    });

    res.status(200).json(formattedHistory);
  } catch (error) {
    console.error(`Error fetching audit history for user ${userId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getUserAuditHistory };