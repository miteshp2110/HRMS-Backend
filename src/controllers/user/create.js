// const bcrypt = require('bcryptjs');
// const { pool } = require('../../db/connector');
// const { uploadProfileImage } = require('../../services/s3Service');

// /**
//  * @description Creates a new user in the system.
//  */
// const createUser = async (req, res) => {
//   const {
//     firstName, lastName, dob, email, phone, password, gender,
//     emergencyContactName, emergencyContactRelation, emergencyContactNumber,
//     joiningDate, systemRole, jobRole, shift, reportsTo, isProbation
//   } = req.body;

//   if (!firstName || !lastName || !email || !password || !joiningDate || !systemRole || !shift) {
//     return res.status(400).json({ message: 'Missing required fields.' });
//   }

//   const createdBy = req.user.id;
//   let connection;

//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const checkSql = 'SELECT id FROM user WHERE email = ? OR phone = ?';
//     const [existingUsers] = await connection.query(checkSql, [email, phone]);
//     if (existingUsers.length > 0) {
//       await connection.rollback();
//       return res.status(409).json({ message: 'User with this email or phone number already exists.' });
//     }

//     let profileUrl = null
//     if (req.file) {
//       profileUrl = await uploadProfileImage(req.file.buffer, req.file.originalname, req.file.mimetype);
//     }

//     const salt = await bcrypt.genSalt(10);
//     const passwordHash = await bcrypt.hash(password, salt);

//     const insertSql = `
//       INSERT INTO user (
//         first_name, last_name, dob, email, phone, password_hash, profile_url, gender,
//         emergency_contact_name, emergency_contact_relation, emergency_contact_number,
//         joining_date, system_role, job_role, shift, reports_to, created_by, is_probation
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
//     `;
//     const [result] = await connection.query(insertSql, [
//       firstName, lastName, dob, email, phone, passwordHash, profileUrl, gender,
//       emergencyContactName, emergencyContactRelation, emergencyContactNumber,
//       joiningDate, systemRole, jobRole, shift, reportsTo, createdBy, isProbation
//     ]);

//     await connection.commit();

//     res.status(201).json({
//       success: true,
//       message: 'User created successfully.',
//       user: { id: result.insertId, email },
//     });
//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error('Error creating user:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { createUser };


const bcrypt = require('bcryptjs');
const { pool } = require('../../db/connector');
const { uploadProfileImage } = require('../../services/s3Service');

/**
 * @description Creates a new user in the system.
 */
const createUser = async (req, res) => {
  const {
    id, firstName, lastName, dob, email, phone, password, gender,
    emergencyContactName, emergencyContactRelation, emergencyContactNumber,
    joiningDate, systemRole, jobRole, shift, reportsTo, isProbation, nationality
  } = req.body;

  if (!id || !firstName || !lastName || !email || !password || !joiningDate || !systemRole || !shift) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  console.log(id)
  const createdBy = req.user.id;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const checkSql = 'SELECT id FROM user WHERE email = ? OR phone = ? OR employee_id = ?';
    const [existingUsers] = await connection.query(checkSql, [email, phone, employee_id]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'User with this email, phone number, or employee ID already exists.' });
    }

    let profileUrl = null
    if (req.file) {
      profileUrl = await uploadProfileImage(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertSql = `
      INSERT INTO user (
        id, first_name, last_name, dob, email, phone, password_hash, profile_url, gender,
        emergency_contact_name, emergency_contact_relation, emergency_contact_number,
        joining_date, system_role, job_role, shift, reports_to, created_by, is_probation, nationality
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await connection.query(insertSql, [
      id, firstName, lastName, dob, email, phone, passwordHash, profileUrl, gender,
      emergencyContactName, emergencyContactRelation, emergencyContactNumber,
      joiningDate, systemRole, jobRole, shift, reportsTo, createdBy, isProbation, nationality
    ]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: { id: result.insertId, employee_id, email },
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createUser };