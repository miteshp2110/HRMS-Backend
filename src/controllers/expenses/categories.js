const { pool } = require('../../db/connector');

/**
 * @description [Admin] Creates a new expense category.
 */
const createCategory = async (req, res) => {
    const { name, description } = req.body;
    const created_by = req.user.id;

    if (!name) {
        return res.status(400).json({ message: 'Category name is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            INSERT INTO expense_categories (name, description, updated_by)
            VALUES (?, ?, ?);
        `;
        const [result] = await connection.query(sql, [name, description || null, created_by]);

        res.status(201).json({
            success: true,
            message: 'Expense category created successfully.',
            categoryId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An expense category with this name already exists.' });
        }
        console.error('Error creating expense category:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets a list of all expense categories.
 */
const getAllCategories = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [categories] = await connection.query('SELECT * FROM expense_categories ORDER BY name ASC');
        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching expense categories:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Updates an existing expense category.
 */
const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    const updated_by = req.user.id;

    if (!name) {
        return res.status(400).json({ message: 'Category name is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            UPDATE expense_categories
            SET name = ?, description = ?, updated_by = ?
            WHERE id = ?;
        `;
        const [result] = await connection.query(sql, [name, description || null, updated_by, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Expense category not found.' });
        }

        res.status(200).json({ success: true, message: 'Expense category updated successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'An expense category with this name already exists.' });
        }
        console.error('Error updating expense category:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Deletes an expense category.
 */
const deleteCategory = async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM expense_categories WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Expense category not found.' });
        }

        res.status(204).send();
    } catch (error) {
        // Handle foreign key constraint error if the category is in use
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ message: 'Cannot delete this category because it is currently being used by one or more expense claims.' });
        }
        console.error('Error deleting expense category:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory
};