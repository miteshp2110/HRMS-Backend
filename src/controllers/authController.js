const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/connector');
const secrets = require('../config/secrets');

/**
 * @description Logs in a user by verifying their email and password.
 * On success, it returns a JWT containing the user's ID and email.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */

// ... (bcrypt, jwt, pool, secrets imports)

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // Updated SQL to join roles and permissions
    const sql = `
      SELECT 
        u.id, 
        u.email, 
        u.first_name,
        u.last_name,
        u.profile_url,
        u.password_hash,
        u.salary_visibility,
        r.name AS role_name,
        p.name AS permission_name
      FROM user u
      JOIN roles r ON u.system_role = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role
      LEFT JOIN permissions p ON rp.permission = p.id
      WHERE u.email = ? AND u.is_active = TRUE;
    `;
    const [rows] = await connection.query(sql, [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // --- JWT Payload remains minimal ---
    const payload = { id: user.id, email: user.email };
    const token = jwt.sign(payload, secrets.jwtSecret, { expiresIn: '15d' });

    // --- User object in response is now much richer ---
    const userProfile = {
      id: user.id,
      email: user.email,
      salary_visibility:user.salary_visibility===1?true:false,
      role: user.role_name,
      first_name : user.first_name,
      last_name:user.last_name,
      profile_url : user.profile_url,
      permissions: rows.map(row => row.permission_name).filter(p => p !== null)
    };

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: token,
      user: userProfile // Send the full profile to the frontend
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


/**
 * @description Changes a user's password (Super Admin functionality).
 * Accepts user ID and new password, hashes it, and updates in database.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 */
const changePassword = async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ message: 'User ID and password are required.' });
  }

  // Password validation (optional but recommended)
  if (password.length < 8) {
    return res.status(400).json({success:false,message: 'Password must be at least 8 characters long.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Check if user exists
    const [userCheck] = await connection.query(
      'SELECT id FROM user WHERE id = ?',
      [id]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({ success:false,message: 'User not found.' });
    }

    // Hash the new password
    const saltRounds = 8;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Update the password in database
    const updateSql = 'UPDATE user SET password_hash = ? WHERE id = ?';
    await connection.query(updateSql, [password_hash, id]);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { login, changePassword };
