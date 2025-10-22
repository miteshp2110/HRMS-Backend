
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
      
//       // Parse ID from "ID - Name" string
//       if (userData.system_role && typeof userData.system_role === 'string') {
//           userData.system_role = userData.system_role.split(' - ')[0];
//       }
//       if (userData.job_role && typeof userData.job_role === 'string') {
//           userData.job_role = userData.job_role.split(' - ')[0];
//       }
//       if (userData.shift && typeof userData.shift === 'string') {
//           userData.shift = userData.shift.split(' - ')[0];
//       }
//       if (userData.reports_to && typeof userData.reports_to === 'string') {
//           userData.reports_to = userData.reports_to.split(' - ')[0];
//       }


//       usersToCreate.push(userData);
//     });

//     if (errors.length > 0) {
//       await connection.rollback();
//       return res.status(400).json({ message: 'Validation failed.', errors });
//     }

//     for (const user of usersToCreate) {
//       const salt = await bcrypt.genSalt(10);
//       const password_hash = await bcrypt.hash(user.password.toString(), salt);

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
 * @description Helper function to extract actual value from Excel cells
 */
const getCellValue = (cell) => {
  const value = cell.value;
  
  // If it's null or undefined, return null
  if (value === null || value === undefined) {
    return null;
  }
  
  // If it's a hyperlink object, extract the text
  if (value && typeof value === 'object' && value.text !== undefined) {
    return value.text;
  }
  
  // If it's a date object, convert to proper format
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // If it's an object with hyperlink property
  if (value && typeof value === 'object' && value.hyperlink) {
    return value.text || value.hyperlink;
  }
  
  // Return the value as-is
  return value;
};

/**
 * @description Processes a bulk user upload from an Excel file with three sheets:
 * Users, Bank Details, and Leave Balances
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
    
    const usersSheet = workbook.getWorksheet('Users');
    const bankDetailsSheet = workbook.getWorksheet('Bank Details');
    const leaveBalancesSheet = workbook.getWorksheet('Leave Balances');

    const usersToCreate = [];
    const bankDetailsMap = new Map(); // key: user_id, value: bank details
    const leaveBalancesMap = new Map(); // key: user_id, value: leave balances object
    const errors = [];

    // --- 1. Parse Users Sheet ---
    usersSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const userData = {
        id: getCellValue(row.getCell('A')),
        first_name: getCellValue(row.getCell('B')),
        last_name: getCellValue(row.getCell('C')),
        dob: getCellValue(row.getCell('D')),
        email: getCellValue(row.getCell('E')),
        phone: getCellValue(row.getCell('F')),
        gender: getCellValue(row.getCell('G')),
        joining_date: getCellValue(row.getCell('H')),
        nationality: getCellValue(row.getCell('I')),
        emergency_contact_name: getCellValue(row.getCell('J')),
        emergency_contact_relation: getCellValue(row.getCell('K')),
        emergency_contact_number: getCellValue(row.getCell('L')),
        system_role: getCellValue(row.getCell('M')),
        job_role: getCellValue(row.getCell('N')),
        shift: getCellValue(row.getCell('O')),
        reports_to: getCellValue(row.getCell('P')),
        is_probation: getCellValue(row.getCell('Q')),
        probation_days: getCellValue(row.getCell('R')) || 0,
      };

      // Basic validation
      if (!userData.first_name || !userData.last_name || !userData.email) {
        errors.push({ sheet: 'Users', row: rowNumber, message: 'Missing required fields (first name, last name, email).' });
        return;
      }
     
      // Parse ID from "ID - Name" string and convert to integer
      if (userData.system_role && typeof userData.system_role === 'string') {
          userData.system_role = parseInt(userData.system_role.split(' - ')[0]);
      } else if (userData.system_role) {
          userData.system_role = parseInt(userData.system_role);
      }
      
      if (userData.job_role && typeof userData.job_role === 'string') {
          userData.job_role = parseInt(userData.job_role.split(' - ')[0]);
      } else if (userData.job_role) {
          userData.job_role = parseInt(userData.job_role);
      }
      
      if (userData.shift && typeof userData.shift === 'string') {
          userData.shift = parseInt(userData.shift.split(' - ')[0]);
      } else if (userData.shift) {
          userData.shift = parseInt(userData.shift);
      }
      
      if (userData.reports_to && typeof userData.reports_to === 'string') {
          userData.reports_to = parseInt(userData.reports_to.split(' - ')[0]);
      } else if (userData.reports_to) {
          userData.reports_to = parseInt(userData.reports_to);
      }

      // Convert phone and emergency contact number to string
      if (userData.phone) {
        userData.phone = String(userData.phone);
      }
      if (userData.emergency_contact_number) {
        userData.emergency_contact_number = String(userData.emergency_contact_number);
      }

      // Parse is_probation (Yes/No to 1/0)
      if (userData.is_probation) {
        const probationValue = String(userData.is_probation).toLowerCase();
        userData.is_probation = (probationValue === 'yes' || probationValue === '1') ? 1 : 0;
      } else {
        userData.is_probation = 1; // Default to probation
      }

      // Convert probation_days to integer
      userData.probation_days = parseInt(userData.probation_days) || 0;

      usersToCreate.push(userData);
    });

    // --- 2. Parse Bank Details Sheet ---
    if (bankDetailsSheet) {
      bankDetailsSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        let userValue = getCellValue(row.getCell('A'));
        
        // Skip empty rows
        if (!userValue) return;
        
        // Parse user ID from "ID - FirstName LastName" format
        let userId = null;
        if (typeof userValue === 'string') {
          userId = parseInt(userValue.split(' - ')[0].trim());
        } else {
          userId = parseInt(userValue);
        }

        const bankData = {
          user_id: userId,
          bank_name: getCellValue(row.getCell('B')),
          bank_account: String(getCellValue(row.getCell('C'))),
          bank_ifsc: getCellValue(row.getCell('D')),
        };

        // Validate bank details
        if (bankData.user_id && bankData.bank_name && bankData.bank_account && bankData.bank_ifsc) {
          bankDetailsMap.set(bankData.user_id, bankData);
        } else if (bankData.user_id) {
          errors.push({ sheet: 'Bank Details', row: rowNumber, message: 'Missing required bank fields.' });
        }
      });
    }

    // --- 3. Parse Leave Balances Sheet ---
    if (leaveBalancesSheet) {
      // Get leave type IDs from header row
      const headerRow = leaveBalancesSheet.getRow(1);
      const leaveTypeColumns = [];
      
      // Get leave type mapping from database
      const [leaveTypes] = await connection.query('SELECT id, name FROM leave_types ORDER BY id ASC');
      const leaveTypeNameToIdMap = new Map();
      leaveTypes.forEach(lt => {
        leaveTypeNameToIdMap.set(lt.name, lt.id);
      });

      headerRow.eachCell((cell, colNumber) => {
        if (colNumber > 1) { // Skip User column
          const leaveTypeName = getCellValue(cell);
          const leaveTypeId = leaveTypeNameToIdMap.get(leaveTypeName);
          
          if (leaveTypeId) {
            leaveTypeColumns.push({
              colNumber: colNumber,
              leaveTypeId: leaveTypeId,
              leaveTypeName: leaveTypeName
            });
          }
        }
      });

      leaveBalancesSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        let userValue = getCellValue(row.getCell('A'));
        
        // Skip empty rows
        if (!userValue) return;
        
        // Parse user ID from "ID - FirstName LastName" format
        let userId = null;
        if (typeof userValue === 'string') {
          userId = parseInt(userValue.split(' - ')[0].trim());
        } else {
          userId = parseInt(userValue);
        }

        if (!userId) return;

        const leaveBalances = {};
        
        // Read leave balances for each leave type
        leaveTypeColumns.forEach(ltCol => {
          const balance = getCellValue(row.getCell(ltCol.colNumber));
          
          if (balance !== null && balance !== undefined && balance !== '') {
            leaveBalances[ltCol.leaveTypeId] = parseFloat(balance) || 0;
          }
        });

        if (Object.keys(leaveBalances).length > 0) {
          leaveBalancesMap.set(userId, leaveBalances);
        }
      });
    }

    // --- 4. Check for errors before proceeding ---
    if (errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    // --- 5. Insert Users ---
    for (const user of usersToCreate) {
      // Hash password as "password"
      const salt = await bcrypt.genSalt(8);
      const password_hash = await bcrypt.hash('password', salt);

      const sql = `
        INSERT INTO user (
          id, first_name, last_name, dob, email, phone, password_hash, gender,
          joining_date, nationality, emergency_contact_name, emergency_contact_relation,
          emergency_contact_number, system_role, job_role, shift, reports_to, 
          is_probation, probation_days, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      await connection.query(sql, [
        user.id, 
        user.first_name, 
        user.last_name, 
        user.dob, 
        user.email, 
        user.phone, 
        password_hash, 
        user.gender, 
        user.joining_date, 
        user.nationality, 
        user.emergency_contact_name, 
        user.emergency_contact_relation,
        user.emergency_contact_number, 
        user.system_role, 
        user.job_role, 
        user.shift, 
        user.reports_to, 
        user.is_probation, 
        user.probation_days, 
        created_by
      ]);

      // --- 6. Insert Bank Details if provided ---
      const bankDetails = bankDetailsMap.get(user.id);
      if (bankDetails) {
        const bankSql = `
          INSERT INTO bank_details (user_id, bank_name, bank_account, bank_ifsc, updated_by)
          VALUES (?, ?, ?, ?, ?);
        `;
        await connection.query(bankSql, [
          user.id,
          bankDetails.bank_name,
          bankDetails.bank_account,
          bankDetails.bank_ifsc,
          created_by
        ]);
      }

      // --- 7. Update Leave Balances if provided ---
      const leaveBalances = leaveBalancesMap.get(user.id);
      if (leaveBalances) {
        for (const [leaveTypeId, balance] of Object.entries(leaveBalances)) {
          const leaveSql = `
            UPDATE employee_leave_balance 
            SET balance = ?, updated_by = ?
            WHERE employee_id = ? AND leave_id = ?;
          `;
          await connection.query(leaveSql, [balance, created_by, user.id, leaveTypeId]);
        }
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: `${usersToCreate.length} users created successfully with bank details and leave balances.`,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error during bulk user upload:', error);
    res.status(500).json({ message: 'An internal server error occurred.', error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { bulkUploadUsers };
