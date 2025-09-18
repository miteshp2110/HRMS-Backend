const { pool } = require('../../../db/connector');

// A secure whitelist mapping table names from the DB to their searchable columns and display names.
// This is a CRITICAL security measure to prevent SQL injection on table/column names.
// The keys here MUST exactly match the 'table_name' values in your 'name_series' table.
const tableConfig = {
    user: {
        searchColumn: 'id', // Special case: search the 'employee_id' column
        type: 'Employee'
    },
    employee_leave_records: { // Corrected table name
        searchColumn: 'id',          // Default case: search the primary key 'id'
        type: 'Leave Record'
    },
    payrolls: {
        searchColumn: 'id',
        type: 'Payroll Record'
    },
    employee_loans: {
        searchColumn: 'id',
        type: 'Loan / Advance'
    },
};

/**
 * @description Performs a global search across different tables using a prefixed ID.
 */
const globalSearchByPrefixedId = async (req, res) => {
    const { searchTerm } = req.params;

    if (!searchTerm || !searchTerm.includes('-')) {
        return res.status(400).json({ message: 'Invalid search format. Expected format: PREFIX-ID' });
    }
    
    // This handles prefixes like 'EMP' and ID values like '00004'
    const prefix = searchTerm.substring(0, searchTerm.indexOf('-'));
    const idValue = searchTerm.substring(searchTerm.indexOf('-') + 1);

    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Look up the prefix in the name_series table to find the real table name
        const [[series]] = await connection.query(
            'SELECT table_name FROM name_series WHERE prefix = ?',
            [prefix]
        );

        if (!series) {
            return res.status(404).json({ message: `No record type found for prefix "${prefix}".` });
        }

        const { table_name } = series;

        // 2. Check if the found table is in our secure whitelist
        if (!tableConfig[table_name]) {
            return res.status(400).json({ message: `Searching on table "${table_name}" is not supported.` });
        }
        
        const { searchColumn, type } = tableConfig[table_name];

        // 3. Perform the final search on the correct table and column
        // We can safely construct this query because the table and column names
        // come from our secure `tableConfig` whitelist, not from user input.
        const searchSql = `SELECT id FROM \`${table_name}\` WHERE \`${searchColumn}\` = ? LIMIT 1;`;
        const [[record]] = await connection.query(searchSql, [idValue]);

        if (!record) {
            return res.status(404).json({ message: `No ${type} found with ID "${idValue}".` });
        }

        // 4. Return the successful response
        res.status(200).json({
            type: type,
            id: record.id // Always return the internal primary key ID for linking
        });

    } catch (error) {
        console.error('Error during global search:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { globalSearchByPrefixedId };