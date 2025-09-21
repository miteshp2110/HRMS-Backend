// const ExcelJS = require('exceljs');
// const bcrypt = require('bcryptjs');
// const { pool } = require('../../db/connector');

// /**
//  * @description Processes a bulk user upload from an Excel file.
//  */
// const bulkUploadUsers = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: 'No file uploaded.' });
//   }

//   const created_by = req.user.id;
//   let connection;

//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.load(req.file.buffer);
//     const worksheet = workbook.getWorksheet('Users');

//     const usersToCreate = [];
//     const errors = [];

//     worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
//       if (rowNumber === 1) return; // Skip header row

//       const userData = {
//         id: row.getCell('A').value,
//         first_name: row.getCell('B').value,
//         last_name: row.getCell('C').value,
//         dob: row.getCell('D').value,
//         email: row.getCell('E').value,
//         phone: row.getCell('F').value,
//         password: row.getCell('G').value,
//         gender: row.getCell('H').value,
//         joining_date: row.getCell('I').value,
//         nationality: row.getCell('J').value,
//         emergency_contact_name: row.getCell('K').value,
//         emergency_contact_relation: row.getCell('L').value,
//         emergency_contact_number: row.getCell('M').value,
//         system_role: row.getCell('N').value,
//         job_role: row.getCell('O').value,
//         shift: row.getCell('P').value,
//         reports_to: row.getCell('Q').value,
//       };

//       // Basic validation
//       if (!userData.first_name || !userData.last_name || !userData.email || !userData.password) {
//         errors.push({ row: rowNumber, message: 'Missing required fields.' });
//         return;
//       }

//       usersToCreate.push(userData);
//     });

//     if (errors.length > 0) {
//       await connection.rollback();
//       return res.status(400).json({ message: 'Validation failed.', errors });
//     }

//     for (const user of usersToCreate) {
//       const salt = await bcrypt.genSalt(10);
//       const password_hash = await bcrypt.hash(user.password, salt);

//       const sql = `
//         INSERT INTO user (
//           id, first_name, last_name, dob, email, phone, password_hash, gender,
//           joining_date, nationality, emergency_contact_name, emergency_contact_relation,
//           emergency_contact_number, system_role, job_role, shift, reports_to, created_by
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
//       `;

//       await connection.query(sql, [
//         user.id, user.first_name, user.last_name, user.dob, user.email, user.phone, password_hash, user.gender,
//         user.joining_date, user.nationality, user.emergency_contact_name, user.emergency_contact_relation,
//         user.emergency_contact_number, user.system_role, user.job_role, user.shift, user.reports_to, created_by
//       ]);
//     }

//     await connection.commit();

//     res.status(201).json({
//       success: true,
//       message: `${usersToCreate.length} users created successfully.`,
//     });
//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error('Error during bulk user upload:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { bulkUploadUsers };

const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const { pool } = require('../../db/connector');

/**
 * @description Processes a bulk user upload from an Excel file.
 */
const bulkUploadUsers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const created_by = req.user.id;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet('Users');

    const usersToCreate = [];
    const errors = [];

    worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const userData = {
        id: row.getCell('A').value,
        first_name: row.getCell('B').value,
        last_name: row.getCell('C').value,
        dob: row.getCell('D').value,
        email: row.getCell('E').value,
        phone: row.getCell('F').value,
        password: row.getCell('G').value,
        gender: row.getCell('H').value,
        joining_date: row.getCell('I').value,
        nationality: row.getCell('J').value,
        emergency_contact_name: row.getCell('K').value,
        emergency_contact_relation: row.getCell('L').value,
        emergency_contact_number: row.getCell('M').value,
        system_role: row.getCell('N').value,
        job_role: row.getCell('O').value,
        shift: row.getCell('P').value,
        reports_to: row.getCell('Q').value,
      };

      // Basic validation
      if (!userData.first_name || !userData.last_name || !userData.email || !userData.password) {
        errors.push({ row: rowNumber, message: 'Missing required fields.' });
        return;
      }
      
      // Parse ID from "ID - Name" string
      if (userData.system_role && typeof userData.system_role === 'string') {
          userData.system_role = userData.system_role.split(' - ')[0];
      }
      if (userData.job_role && typeof userData.job_role === 'string') {
          userData.job_role = userData.job_role.split(' - ')[0];
      }
      if (userData.shift && typeof userData.shift === 'string') {
          userData.shift = userData.shift.split(' - ')[0];
      }
      if (userData.reports_to && typeof userData.reports_to === 'string') {
          userData.reports_to = userData.reports_to.split(' - ')[0];
      }


      usersToCreate.push(userData);
    });

    if (errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    for (const user of usersToCreate) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(user.password.toString(), salt);

      const sql = `
        INSERT INTO user (
          id, first_name, last_name, dob, email, phone, password_hash, gender,
          joining_date, nationality, emergency_contact_name, emergency_contact_relation,
          emergency_contact_number, system_role, job_role, shift, reports_to, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      await connection.query(sql, [
        user.id, user.first_name, user.last_name, user.dob, user.email, user.phone, password_hash, user.gender,
        user.joining_date, user.nationality, user.emergency_contact_name, user.emergency_contact_relation,
        user.emergency_contact_number, user.system_role, user.job_role, user.shift, user.reports_to, created_by
      ]);
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: `${usersToCreate.length} users created successfully.`,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error during bulk user upload:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { bulkUploadUsers };