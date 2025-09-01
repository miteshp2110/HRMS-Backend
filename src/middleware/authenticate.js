// const jwt = require('jsonwebtoken');
// const secrets = require('../config/secrets');
// const { pool } = require('../db/connector');

// /**
//  * @description Middleware to authenticate a user via JWT.
//  * It verifies the token and attaches the user's full details, role, and permissions to the request object.
//  */
// const authenticate = async (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ message: 'Authentication failed. No token provided.' });
//   }

//   const token = authHeader.split(' ')[1];
//   let connection;

//   try {
//     // 1. Verify the JWT token
//     const decoded = jwt.verify(token, secrets.jwtSecret);
//     req.user = decoded; // Attach decoded payload (e.g., { id: 1, email: '...' }) to the request

//     // 2. Fetch the user's role and permissions from the database
//     connection = await pool.getConnection();
//     const sql = `
//       SELECT 
//         u.id, 
//         u.email, 
//         r.name AS role_name,
//         p.name AS permission_name
//       FROM user u
//       JOIN roles r ON u.system_role = r.id
//       LEFT JOIN role_permissions rp ON r.id = rp.role
//       LEFT JOIN permissions p ON rp.permission = p.id
//       WHERE u.id = ? AND u.is_active = TRUE;
//     `;
    
//     const [rows] = await connection.query(sql, [req.user.id]);

//     if (rows.length === 0) {
//       return res.status(401).json({ message: 'Authentication failed. User not found or is inactive.' });
//     }

//     // 3. Structure the user's permissions and attach to the request object
//     const userProfile = {
//       id: rows[0].id,
//       email: rows[0].email,
//       role: rows[0].role_name,
//       permissions: rows.map(row => row.permission_name).filter(p => p !== null) // Create an array of permission names
//     };

//     req.user = userProfile; // Overwrite the initial decoded token with the full user profile
    
//     next(); // User is authenticated, proceed to the next middleware or route handler

//   } catch (error) {
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({ message: 'Authentication failed. Invalid token.' });
//     }
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({ message: 'Authentication failed. Token has expired.' });
//     }
//     console.error('Authentication error:', error);
//     return res.status(500).json({ message: 'An internal server error occurred during authentication.' });
//   } finally {
//     if (connection) {
//       connection.release();
//     }
//   }
// };

// module.exports = authenticate;






const jwt = require('jsonwebtoken');
const secrets = require('../config/secrets');
const { pool } = require('../db/connector');

/**
 * @description Middleware to authenticate a user via JWT.
 * It verifies the token and attaches the user's full details, role, shift, and permissions to the request object.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication failed. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  let connection;

  try {
    // 1. Verify the JWT token
    const decoded = jwt.verify(token, secrets.jwtSecret);
    req.user = decoded; // Attach decoded payload (e.g., { id: 1, email: '...' }) to the request

    // 2. Fetch the user's role, shift, and permissions from the database
    connection = await pool.getConnection();
    const sql = `
      SELECT 
        u.id, 
        u.email, 
        u.shift,  -- ✅ get the shift_id
        r.name AS role_name,
        p.name AS permission_name
      FROM user u
      JOIN roles r ON u.system_role = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role
      LEFT JOIN permissions p ON rp.permission = p.id
      WHERE u.id = ? AND u.is_active = TRUE;
    `;
    
    const [rows] = await connection.query(sql, [req.user.id]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Authentication failed. User not found or is inactive.' });
    }

    // 3. Structure the user's profile (with shift)
    const userProfile = {
      id: rows[0].id,
      email: rows[0].email,
      role: rows[0].role_name,
      shift: rows[0].shift, // ✅ shift_id is now available on req.user
      permissions: rows.map(row => row.permission_name).filter(p => p !== null)
    };

    req.user = userProfile; // Overwrite the initial decoded token with full user profile
    
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Authentication failed. Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication failed. Token has expired.' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'An internal server error occurred during authentication.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = authenticate;
