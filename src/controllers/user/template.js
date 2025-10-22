
// const ExcelJS = require('exceljs');
// const { pool } = require('../../db/connector');

// /**
//  * @description Generates and sends an Excel template for bulk user uploads,
//  * including a reference sheet with IDs and dropdowns for roles, jobs, shifts, and users.
//  */
// const generateUserUploadTemplate = async (req, res) => {
//   let connection;
//   try {
//     connection = await pool.getConnection();

//     // 1. Fetch all necessary data in parallel
//     const rolesPromise = connection.query('SELECT id, name FROM roles ORDER BY name ASC');
//     const jobsPromise = connection.query('SELECT id, title FROM jobs ORDER BY title ASC');
//     const shiftsPromise = connection.query('SELECT id, name FROM shifts ORDER BY name ASC');
//     const usersPromise = connection.query("SELECT id, CONCAT(first_name, ' ', last_name) as name FROM user WHERE is_active = TRUE ORDER BY first_name ASC");

//     const [
//         [roles],
//         [jobs],
//         [shifts],
//         [users]
//     ] = await Promise.all([rolesPromise, jobsPromise, shiftsPromise, usersPromise]);


//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Users');
//     const referenceSheet = workbook.addWorksheet('Reference Data');

//     // --- 2. Populate the main 'Users' worksheet ---
//     worksheet.columns = [
//       { header: 'ID', key: 'id', width: 10 },
//       { header: 'First Name', key: 'first_name', width: 20 },
//       { header: 'Last Name', key: 'last_name', width: 20 },
//       { header: 'Date of Birth (YYYY-MM-DD)', key: 'dob', width: 25 },
//       { header: 'Email', key: 'email', width: 30 },
//       { header: 'Phone', key: 'phone', width: 20 },
//       { header: 'Password', key: 'password', width: 20 },
//       { header: 'Gender', key: 'gender', width: 15 },
//       { header: 'Joining Date (YYYY-MM-DD)', key: 'joining_date', width: 25 },
//       { header: 'Nationality', key: 'nationality', width: 20 },
//       { header: 'Emergency Contact Name', key: 'emergency_contact_name', width: 30 },
//       { header: 'Emergency Contact Relation', key: 'emergency_contact_relation', width: 30 },
//       { header: 'Emergency Contact Number', key: 'emergency_contact_number', width: 30 },
//       { header: 'System Role', key: 'system_role', width: 20 },
//       { header: 'Job Role', key: 'job_role', width: 20 },
//       { header: 'Shift', key: 'shift', width: 20 },
//       { header: 'Reports To', key: 'reports_to', width: 25 },
//     ];

//     // --- 3. Populate the 'Reference Data' worksheet ---
//     referenceSheet.columns = [
//         { header: 'Type', key: 'type', width: 25 },
//         { header: 'ID', key: 'id', width: 10 },
//         { header: 'Name', key: 'name', width: 35 },
//         { header: 'Dropdown Value', key: 'dropdown', width: 40 }, // New column for combined value
//     ];
    
//     let currentRow = 2;
//     // Add Roles and track row numbers
//     referenceSheet.getCell('A1').value = 'Roles';
//     referenceSheet.getCell('A1').font = { bold: true };
//     const rolesStartRow = currentRow;
//     roles.forEach(role => {
//         referenceSheet.addRow(['', role.id, role.name, `${role.id} - ${role.name}`])
//     });
//     currentRow += roles.length;
//     const rolesEndRow = currentRow -1;
//     currentRow++;

//     // Add Jobs and track row numbers
//     referenceSheet.getCell(`A${currentRow}`).value = 'Jobs';
//     referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
//     currentRow++;
//     const jobsStartRow = currentRow;
//     jobs.forEach(job => {
//         referenceSheet.addRow(['', job.id, job.title, `${job.id} - ${job.title}`])
//     });
//     currentRow += jobs.length;
//     const jobsEndRow = currentRow - 1;
//     currentRow++;

//     // Add Shifts and track row numbers
//     referenceSheet.getCell(`A${currentRow}`).value = 'Shifts';
//     referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
//     currentRow++;
//     const shiftsStartRow = currentRow;
//     shifts.forEach(shift => {
//         referenceSheet.addRow(['', shift.id, shift.name, `${shift.id} - ${shift.name}`])
//     });
//     currentRow += shifts.length;
//     const shiftsEndRow = currentRow-1;
//     currentRow++;

//     // Add Users and track row numbers
//     referenceSheet.getCell(`A${currentRow}`).value = 'Users (for Reports To)';
//     referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
//     currentRow++;
//     const usersStartRow = currentRow;
//     users.forEach(user => {
//         referenceSheet.addRow(['', user.id, user.name, `${user.id} - ${user.name}`])
//     });
//     currentRow += users.length;
//     const usersEndRow = currentRow-1;
    
//     // --- 4. Add Data Validations (Dropdowns) to the 'Users' sheet ---
//     const maxRows = 1000; // Apply validation for the next 1000 rows
//     worksheet.dataValidations.add(`H2:H${maxRows}`, {
//       type: 'list',
//       allowBlank: true,
//       formulae: ['"Male,Female"'],
//     });
//     worksheet.dataValidations.add(`N2:N${maxRows}`, {
//       type: 'list',
//       allowBlank: true,
//       formulae: [`'Reference Data'!$D$${rolesStartRow}:$D$${rolesEndRow}`]
//     });
//     worksheet.dataValidations.add(`O2:O${maxRows}`, {
//       type: 'list',
//       allowBlank: true,
//       formulae: [`'Reference Data'!$D$${jobsStartRow}:$D$${jobsEndRow}`]
//     });
//     worksheet.dataValidations.add(`P2:P${maxRows}`, {
//       type: 'list',
//       allowBlank: true,
//       formulae: [`'Reference Data'!$D$${shiftsStartRow}:$D$${shiftsEndRow}`]
//     });
//     worksheet.dataValidations.add(`Q2:Q${maxRows}`, {
//       type: 'list',
//       allowBlank: true,
//       formulae: [`'Reference Data'!$D$${usersStartRow}:$D$${usersEndRow}`]
//     });


//     // --- 5. Send the file ---
//     res.setHeader(
//       'Content-Type',
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//     );
//     res.setHeader(
//       'Content-Disposition',
//       'attachment; filename="user_upload_template.xlsx"'
//     );

//     await workbook.xlsx.write(res);
//     res.end();
//   } catch (error) {
//     console.error('Error generating user upload template:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//       if(connection) connection.release();
//   }
// };

// module.exports = { generateUserUploadTemplate };

const ExcelJS = require('exceljs');
const { pool } = require('../../db/connector');

/**
 * @description Generates and sends an Excel template for bulk user uploads,
 * including three sheets: Users, Bank Details, and Leave Balances
 * Bank Details and Leave Balances reference users from the Users sheet
 */
const generateUserUploadTemplate = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Fetch all necessary data in parallel
    const rolesPromise = connection.query('SELECT id, name FROM roles ORDER BY name ASC');
    const jobsPromise = connection.query('SELECT id, title FROM jobs ORDER BY title ASC');
    const shiftsPromise = connection.query('SELECT id, name FROM shifts ORDER BY name ASC');
    const usersPromise = connection.query("SELECT id, CONCAT(first_name, ' ', last_name) as name FROM user WHERE is_active = TRUE ORDER BY first_name ASC");
    const leaveTypesPromise = connection.query('SELECT id, name FROM leave_types ORDER BY name ASC');

    const [
        [roles],
        [jobs],
        [shifts],
        [existingUsers],
        [leaveTypes]
    ] = await Promise.all([rolesPromise, jobsPromise, shiftsPromise, usersPromise, leaveTypesPromise]);

    const workbook = new ExcelJS.Workbook();
    const usersSheet = workbook.addWorksheet('Users');
    const bankDetailsSheet = workbook.addWorksheet('Bank Details');
    const leaveBalancesSheet = workbook.addWorksheet('Leave Balances');
    const referenceSheet = workbook.addWorksheet('Reference Data');

    // --- 2. Populate the main 'Users' worksheet ---
    usersSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'Date of Birth (YYYY-MM-DD)', key: 'dob', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Gender', key: 'gender', width: 15 },
      { header: 'Joining Date (YYYY-MM-DD)', key: 'joining_date', width: 25 },
      { header: 'Nationality', key: 'nationality', width: 20 },
      { header: 'Emergency Contact Name', key: 'emergency_contact_name', width: 30 },
      { header: 'Emergency Contact Relation', key: 'emergency_contact_relation', width: 30 },
      { header: 'Emergency Contact Number', key: 'emergency_contact_number', width: 30 },
      { header: 'System Role', key: 'system_role', width: 20 },
      { header: 'Job Role', key: 'job_role', width: 20 },
      { header: 'Shift', key: 'shift', width: 20 },
      { header: 'Reports To', key: 'reports_to', width: 25 },
      { header: 'Is Probation (Yes/No)', key: 'is_probation', width: 20 },
      { header: 'Probation Days', key: 'probation_days', width: 20 },
    ];

    // --- 3. Populate 'Bank Details' worksheet ---
    bankDetailsSheet.columns = [
      { header: 'User', key: 'user', width: 35 },
      { header: 'Bank Name', key: 'bank_name', width: 30 },
      { header: 'Bank Account Number', key: 'bank_account', width: 30 },
      { header: 'Bank IFSC Code', key: 'bank_ifsc', width: 20 },
    ];

    // --- 4. Populate 'Leave Balances' worksheet ---
    // Create dynamic columns based on leave types
    const leaveBalanceColumns = [
      { header: 'User', key: 'user', width: 35 },
    ];
    
    // Add column for each leave type
    leaveTypes.forEach(leaveType => {
      leaveBalanceColumns.push({
        header: leaveType.name,
        key: `leave_${leaveType.id}`,
        width: 15
      });
    });
    
    leaveBalancesSheet.columns = leaveBalanceColumns;

    // --- 5. Populate the 'Reference Data' worksheet ---
    referenceSheet.columns = [
        { header: 'Type', key: 'type', width: 25 },
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Name', key: 'name', width: 35 },
        { header: 'Dropdown Value', key: 'dropdown', width: 40 },
    ];
   
    let currentRow = 2;
    
    // Add Roles and track row numbers
    referenceSheet.getCell('A1').value = 'Roles';
    referenceSheet.getCell('A1').font = { bold: true };
    const rolesStartRow = currentRow;
    roles.forEach(role => {
        referenceSheet.addRow(['', role.id, role.name, `${role.id} - ${role.name}`]);
    });
    currentRow += roles.length;
    const rolesEndRow = currentRow - 1;
    currentRow++;

    // Add Jobs and track row numbers
    referenceSheet.getCell(`A${currentRow}`).value = 'Jobs';
    referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;
    const jobsStartRow = currentRow;
    jobs.forEach(job => {
        referenceSheet.addRow(['', job.id, job.title, `${job.id} - ${job.title}`]);
    });
    currentRow += jobs.length;
    const jobsEndRow = currentRow - 1;
    currentRow++;

    // Add Shifts and track row numbers
    referenceSheet.getCell(`A${currentRow}`).value = 'Shifts';
    referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;
    const shiftsStartRow = currentRow;
    shifts.forEach(shift => {
        referenceSheet.addRow(['', shift.id, shift.name, `${shift.id} - ${shift.name}`]);
    });
    currentRow += shifts.length;
    const shiftsEndRow = currentRow - 1;
    currentRow++;

    // Add Existing Users and track row numbers (for Reports To)
    referenceSheet.getCell(`A${currentRow}`).value = 'Existing Users (for Reports To)';
    referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;
    const existingUsersStartRow = currentRow;
    existingUsers.forEach(user => {
        referenceSheet.addRow(['', user.id, user.name, `${user.id} - ${user.name}`]);
    });
    currentRow += existingUsers.length;
    const existingUsersEndRow = currentRow - 1;
   
    // --- 6. Add Data Validations (Dropdowns) to the 'Users' sheet ---
    const maxRows = 1000;
    
    // Gender dropdown
    usersSheet.dataValidations.add(`G2:G${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: ['"Male,Female"'],
    });
    
    // Is Probation dropdown
    usersSheet.dataValidations.add(`Q2:Q${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: ['"Yes,No"'],
    });
    
    // System Role dropdown
    usersSheet.dataValidations.add(`M2:M${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${rolesStartRow}:$D$${rolesEndRow}`]
    });
    
    // Job Role dropdown
    usersSheet.dataValidations.add(`N2:N${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${jobsStartRow}:$D$${jobsEndRow}`]
    });
    
    // Shift dropdown
    usersSheet.dataValidations.add(`O2:O${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${shiftsStartRow}:$D$${shiftsEndRow}`]
    });
    
    // Reports To dropdown (existing users)
    usersSheet.dataValidations.add(`P2:P${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${existingUsersStartRow}:$D$${existingUsersEndRow}`]
    });

    // --- 7. Add formulas and validations for Bank Details sheet ---
    // Add formulas to create user dropdown list dynamically from Users sheet
    for (let i = 2; i <= maxRows; i++) {
      // Create a helper column formula that concatenates ID and Name from Users sheet
      // This will be used for the dropdown
      bankDetailsSheet.getCell(`E${i}`).value = {
        formula: `IF(Users!A${i}<>"", Users!A${i}&" - "&Users!B${i}&" "&Users!C${i}, "")`,
        result: ''
      };
    }
    
    // Hide the helper column
    bankDetailsSheet.getColumn('E').hidden = true;
    
    // User dropdown in Bank Details (references Users sheet dynamically)
    bankDetailsSheet.dataValidations.add(`A2:A${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`$E$2:$E$${maxRows}`]
    });

    // --- 8. Add formulas and validations for Leave Balances sheet ---
    // Add formulas to create user dropdown list dynamically from Users sheet
    const leaveSheetHelperCol = leaveBalanceColumns.length + 1; // Column after all leave types
    const leaveSheetHelperColLetter = String.fromCharCode(64 + leaveSheetHelperCol); // Convert to letter
    
    for (let i = 2; i <= maxRows; i++) {
      leaveBalancesSheet.getCell(`${leaveSheetHelperColLetter}${i}`).value = {
        formula: `IF(Users!A${i}<>"", Users!A${i}&" - "&Users!B${i}&" "&Users!C${i}, "")`,
        result: ''
      };
    }
    
    // Hide the helper column
    leaveBalancesSheet.getColumn(leaveSheetHelperColLetter).hidden = true;
    
    // User dropdown in Leave Balances (references Users sheet dynamically)
    leaveBalancesSheet.dataValidations.add(`A2:A${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`$${leaveSheetHelperColLetter}$2:$${leaveSheetHelperColLetter}$${maxRows}`]
    });

    // --- 9. Send the file ---
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="user_upload_template.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating user upload template:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
      if(connection) connection.release();
  }
};

module.exports = { generateUserUploadTemplate };
