const { pool } = require('../../db/connector');

/**
 * @description Gets the list of pending skill requests (status IS NULL) for employees who report to the authenticated user.
 */
const getApprovalRequests = async (req, res) => {
  const manager_id = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT 
        esm.id, 
        esm.status,
        esm.created_at,
        u.first_name,
        u.last_name,
        s.skill_name
      FROM employee_skill_matrix esm
      JOIN user u ON esm.employee_id = u.id
      JOIN skills s ON esm.skill_id = s.id
      WHERE u.reports_to = ? AND esm.status IS NULL
    `;
    const [requests] = await connection.query(sql, [manager_id]);
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching approval requests:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Approves (1) or rejects (0) a skill request.
 */
const approveOrRejectRequest = async (req, res) => {
  const { requestId } = req.params;
  const { newStatus } = req.body; // Expects a status: 1 for approved, 0 for rejected
  const approver_id = req.user.id;

  if (newStatus === undefined || ![0, 1].includes(newStatus)) {
    return res.status(400).json({ message: 'A valid newStatus (1 for approve, 0 for reject) is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    const sql = `
      UPDATE employee_skill_matrix esm
      JOIN user u ON esm.employee_id = u.id
      SET 
        esm.status = ?,
        esm.approved_by = ?
      WHERE esm.id = ? AND u.reports_to = ? AND esm.status IS NULL
    `;
    const [result] = await connection.query(sql, [newStatus, approver_id, requestId, approver_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pending request not found for your approval.' });
    }

    res.status(200).json({ success: true, message: 'Request status updated successfully.' });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


module.exports = {
  getApprovalRequests,
  approveOrRejectRequest,
};