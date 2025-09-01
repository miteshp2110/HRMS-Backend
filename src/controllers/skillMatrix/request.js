const { pool } = require('../../db/connector');

/**
 * @description Creates a skill request for the currently authenticated user. Status will be NULL by default.
 */
const createSkillRequest = async (req, res) => {
  const { skill_id } = req.body;
  const employee_id = req.user.id;

  if (!skill_id) {
    return res.status(400).json({ message: 'skill_id is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = 'INSERT INTO employee_skill_matrix (employee_id, skill_id) VALUES (?, ?)';
    const [result] = await connection.query(sql, [employee_id, skill_id]);

    res.status(201).json({
      success: true,
      message: 'Skill request submitted successfully. Awaiting approval.',
      request: { id: result.insertId, employee_id, skill_id, status: null },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'You have already requested this skill.' });
    }
    console.error('Error creating skill request:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets all skill requests for the currently authenticated user.
 */
const getMySkillRequests = async (req, res) => {
  const employee_id = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT esm.*, s.skill_name 
      FROM employee_skill_matrix esm
      JOIN skills s ON esm.skill_id = s.id
      WHERE esm.employee_id = ?
    `;
    const [requests] = await connection.query(sql, [employee_id]);
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching skill requests:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Updates a skill request that is still pending (status IS NULL).
 */
const updateSkillRequest = async (req, res) => {
  const { requestId } = req.params;
  const { skill_id } = req.body;
  const employee_id = req.user.id;

  if (!skill_id) {
    return res.status(400).json({ message: 'New skill_id is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      UPDATE employee_skill_matrix 
      SET skill_id = ? 
      WHERE id = ? AND employee_id = ? AND status IS NULL
    `;
    const [result] = await connection.query(sql, [skill_id, requestId, employee_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pending skill request not found or you do not have permission to edit it.' });
    }

    res.status(200).json({ success: true, message: 'Skill request updated successfully.' });
  } catch (error) {
    console.error('Error updating skill request:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Deletes a skill request that is still pending (status IS NULL).
 */
const deleteSkillRequest = async (req, res) => {
  const { requestId } = req.params;
  const employee_id = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = 'DELETE FROM employee_skill_matrix WHERE id = ? AND employee_id = ? AND status IS NULL';
    const [result] = await connection.query(sql, [requestId, employee_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pending skill request not found or you do not have permission to delete it.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting skill request:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  createSkillRequest,
  getMySkillRequests,
  updateSkillRequest,
  deleteSkillRequest,
};