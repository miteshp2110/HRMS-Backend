const bcrypt = require('bcryptjs');
const { pool } = require('../../db/connector');
const { uploadProfileImage } = require('../../services/s3Service');

/**
 * @description Creates a new user in the system.
 * Handles password hashing and optional profile image upload.
 */
const createUser = async (req, res) => {
  // 1. Destructure and validate required fields from the request body
  const {
    firstName, lastName, dob, email, phone, password, gender,
    emergencyContactName, emergencyContactRelation, emergencyContactNumber,
    joiningDate, systemRole, jobRole, shift, reportsTo, isProbation
  } = req.body;

  // Basic validation
  if (!firstName || !lastName || !email || !password || !joiningDate || !systemRole || !shift) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  // The authenticated user who is creating this new user
  const createdBy = req.user.id;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction(); // Start a transaction

    // 2. Check if email or phone already exists
    const checkSql = 'SELECT id FROM user WHERE email = ? OR phone = ?';
    const [existingUsers] = await connection.query(checkSql, [email, phone]);
    if (existingUsers.length > 0) {
      await connection.rollback(); // Rollback transaction
      return res.status(409).json({ message: 'User with this email or phone number already exists.' });
    }

    // 3. Handle profile image upload (if a file is provided)
    let profileUrl = null; // A default URL
    if (req.file) {
      profileUrl = await uploadProfileImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    }

    // 4. Hash the password
    const salt = await bcrypt.genSalt(8);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Insert the new user into the database
    const insertSql = `
      INSERT INTO user (
        first_name, last_name, dob, email, phone, password_hash, profile_url, gender,
        emergency_contact_name, emergency_contact_relation, emergency_contact_number,
        joining_date, system_role, job_role, shift, reports_to, created_by, is_probation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(insertSql, [
      firstName, lastName, dob, email, phone, passwordHash, profileUrl, gender,
      emergencyContactName, emergencyContactRelation, emergencyContactNumber,
      joiningDate, systemRole, jobRole, shift, reportsTo, createdBy, isProbation
    ]);

    const newUser = {
      id: result.insertId,
      firstName,
      lastName,
      email,
      roleId: systemRole,
    };

    await connection.commit(); // Commit the transaction

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: newUser,
    });

  } catch (error) {
    if (connection) await connection.rollback(); // Rollback on error
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  
  createUser,
};