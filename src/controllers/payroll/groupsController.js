// const { pool } = require('../../db/connector');

// /**
//  * @description Create a new payroll group.
//  */
// exports.createGroup = async (req, res) => {
//     const { group_name, description, components = [] } = req.body;
//     const created_by = req.user.id;

//     if (!group_name) {
//         return res.status(400).json({ message: 'Group name is required.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         await connection.beginTransaction();

//         const [groupResult] = await connection.query(
//             'INSERT INTO payroll_groups (group_name, description, created_by) VALUES (?, ?, ?)',
//             [group_name, description, created_by]
//         );
//         const groupId = groupResult.insertId;

//         if (components.length > 0) {
//             const componentValues = components.map(componentId => [groupId, componentId]);
//             await connection.query('INSERT INTO payroll_group_components (group_id, component_id) VALUES ?', [componentValues]);
//         }

//         await connection.commit();
//         res.status(201).json({ success: true, message: 'Payroll group created successfully.', groupId });
//     } catch (error) {
//         if (connection) await connection.rollback();
//         if (error.code === 'ER_DUP_ENTRY') {
//             return res.status(409).json({ message: 'A payroll group with this name already exists.' });
//         }
//         console.error('Error creating payroll group:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description Get all payroll groups with their component count.
//  */
// exports.getAllGroups = async (req, res) => {
//     try {
//         const [groups] = await pool.query(`
//             SELECT pg.*, COUNT(pgc.component_id) as component_count
//             FROM payroll_groups pg
//             LEFT JOIN payroll_group_components pgc ON pg.id = pgc.group_id
//             GROUP BY pg.id
//             ORDER BY pg.group_name ASC;
//         `);
//         res.status(200).json(groups);
//     } catch (error) {
//         console.error('Error fetching payroll groups:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     }
// };

// /**
//  * @description Get a single payroll group by its ID, including its components.
//  */
// exports.getGroupById = async (req, res) => {
//     const { groupId } = req.params;
//     let connection;
//     try {
//         connection = await pool.getConnection();
//         const [[group]] = await connection.query('SELECT * FROM payroll_groups WHERE id = ?', [groupId]);

//         if (!group) {
//             return res.status(404).json({ message: 'Payroll group not found.' });
//         }

//         const [components] = await connection.query(`
//             SELECT pc.id, pc.name, pc.type
//             FROM payroll_group_components pgc
//             JOIN payroll_components pc ON pgc.component_id = pc.id
//             WHERE pgc.group_id = ?
//             ORDER BY pc.name ASC;
//         `, [groupId]);

//         res.status(200).json({ ...group, components });
//     } catch (error) {
//         console.error('Error fetching payroll group:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description Update a payroll group's details and its assigned components.
//  */
// exports.updateGroup = async (req, res) => {
//     const { groupId } = req.params;
//     const { group_name, description, components } = req.body;

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         await connection.beginTransaction();

//         await connection.query(
//             'UPDATE payroll_groups SET group_name = ?, description = ? WHERE id = ?',
//             [group_name, description, groupId]
//         );

//         // Overwrite the components for simplicity
//         if (Array.isArray(components)) {
//             await connection.query('DELETE FROM payroll_group_components WHERE group_id = ?', [groupId]);
//             if (components.length > 0) {
//                 const componentValues = components.map(componentId => [groupId, componentId]);
//                 await connection.query('INSERT INTO payroll_group_components (group_id, component_id) VALUES ?', [componentValues]);
//             }
//         }

//         await connection.commit();
//         res.status(200).json({ success: true, message: 'Payroll group updated successfully.' });
//     } catch (error) {
//         if (connection) await connection.rollback();
//         if (error.code === 'ER_DUP_ENTRY') {
//             return res.status(409).json({ message: 'A payroll group with this name already exists.' });
//         }
//         console.error('Error updating payroll group:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description Delete a payroll group.
//  */
// exports.deleteGroup = async (req, res) => {
//     const { groupId } = req.params;
//     try {
//         const [result] = await pool.query('DELETE FROM payroll_groups WHERE id = ?', [groupId]);
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Payroll group not found.' });
//         }
//         res.status(204).send();
//     } catch (error) {
//         console.error('Error deleting payroll group:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     }
// };

const { pool } = require('../../db/connector');

/**
 * @description Create a new payroll group.
 */
exports.createGroup = async (req, res) => {
    const { group_name, description, components = [] } = req.body;
    const created_by = req.user.id;

    if (!group_name) {
        return res.status(400).json({ message: 'Group name is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [groupResult] = await connection.query(
            'INSERT INTO payroll_groups (group_name, description, created_by) VALUES (?, ?, ?)',
            [group_name, description, created_by]
        );

        const groupId = groupResult.insertId;

        if (components.length > 0) {
            const componentValues = components.map(componentId => [groupId, componentId]);
            await connection.query('INSERT INTO payroll_group_components (group_id, component_id) VALUES ?', [componentValues]);
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Payroll group created successfully.', groupId });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A payroll group with this name already exists.' });
        }
        console.error('Error creating payroll group:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Get all payroll groups with their component count.
 */
exports.getAllGroups = async (req, res) => {
    try {
        const [groups] = await pool.query(`
            SELECT pg.*, COUNT(pgc.component_id) as component_count,
                   CONCAT(u.first_name, ' ', u.last_name) as created_by_name
            FROM payroll_groups pg
            LEFT JOIN payroll_group_components pgc ON pg.id = pgc.group_id
            LEFT JOIN user u ON pg.created_by = u.id
            GROUP BY pg.id
            ORDER BY pg.group_name ASC;
        `);
        res.status(200).json(groups);
    } catch (error) {
        console.error('Error fetching payroll groups:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

/**
 * @description Get a single payroll group by its ID, including its components.
 */
exports.getGroupById = async (req, res) => {
    const { groupId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        const [[group]] = await connection.query('SELECT * FROM payroll_groups WHERE id = ?', [groupId]);
        if (!group) {
            return res.status(404).json({ message: 'Payroll group not found.' });
        }

        // Fetch components that exist in the payroll_components table
        const [dbComponents] = await connection.query(`
            SELECT pc.id, pc.name, pc.type
            FROM payroll_group_components pgc
            JOIN payroll_components pc ON pgc.component_id = pc.id
            WHERE pgc.group_id = ?
            ORDER BY pc.name ASC;
        `, [groupId]);

        // Fetch all component IDs associated with the group
        const [allComponentIds] = await connection.query(
            'SELECT component_id FROM payroll_group_components WHERE group_id = ?',
            [groupId]
        );
        const componentIdSet = new Set(allComponentIds.map(c => c.component_id));

        // Define the predefined components
        const predefinedComponents = [
            { id: 97, name: "Loans/Advance Emi Deduction", type: "deduction" },
            { id: 98, name: "HR Cases Deduction", type: "deduction" },
            { id: 99, name: "Expense Reimbursements", type: "earning" },
        ];
        
        // Add predefined components if they are linked in the pivot table
        predefinedComponents.forEach(predefined => {
            if (componentIdSet.has(predefined.id)) {
                // Ensure it's not already added (though it shouldn't be, as they are not in payroll_components)
                if (!dbComponents.some(c => c.id === predefined.id)) {
                    dbComponents.push(predefined);
                }
            }
        });

        res.status(200).json({ ...group, components: dbComponents });
    } catch (error) {
        console.error('Error fetching payroll group:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Update a payroll group's details and its assigned components.
 */
exports.updateGroup = async (req, res) => {
    const { groupId } = req.params;
    const { group_name, description, components } = req.body;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.query(
            'UPDATE payroll_groups SET group_name = ?, description = ? WHERE id = ?',
            [group_name, description, groupId]
        );

        // Overwrite the components for simplicity
        if (Array.isArray(components)) {
            await connection.query('DELETE FROM payroll_group_components WHERE group_id = ?', [groupId]);
            if (components.length > 0) {
                const componentValues = components.map(componentId => [groupId, componentId]);
                await connection.query('INSERT INTO payroll_group_components (group_id, component_id) VALUES ?', [componentValues]);
            }
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Payroll group updated successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A payroll group with this name already exists.' });
        }
        console.error('Error updating payroll group:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Delete a payroll group.
 */
exports.deleteGroup = async (req, res) => {
    const { groupId } = req.params;
    try {
        const [result] = await pool.query('DELETE FROM payroll_groups WHERE id = ?', [groupId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Payroll group not found.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting payroll group:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

/**
 * @description Get all payroll components for frontend dropdown.
 */
exports.getPayrollComponents = async (req, res) => {
    try {
        const [components] = await pool.query(`
            SELECT id, name, type, description
            FROM payroll_components
            ORDER BY type, name
        `);
        res.status(200).json(components);
    } catch (error) {
        console.error('Error fetching payroll components:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};