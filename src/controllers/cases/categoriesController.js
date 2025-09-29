const { pool } = require('../../db/connector');

// Create a new case category
exports.createCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const [result] = await pool.query('INSERT INTO case_categories (name, description, created_by) VALUES (?, ?, ?)', [name, description, req.user.id]);
        res.status(201).json({ id: result.insertId, name, description });
    } catch (error) {
        res.status(500).json({ message: "Error creating category.", error: error.message });
    }
};

// Get all case categories
exports.getAllCategories = async (req, res) => {
    try {
        const [categories] = await pool.query('SELECT * FROM case_categories ORDER BY name ASC');
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: "Error fetching categories.", error: error.message });
    }
};