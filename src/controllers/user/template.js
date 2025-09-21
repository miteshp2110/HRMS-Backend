// const ExcelJS = require('exceljs');

// /**
//  * @description Generates and sends an Excel template for bulk user uploads.
//  */
// const generateUserUploadTemplate = async (req, res) => {
//   try {
//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Users');

//     // Define the headers for the template
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
//       { header: 'System Role ID', key: 'system_role', width: 15 },
//       { header: 'Job Role ID', key: 'job_role', width: 15 },
//       { header: 'Shift ID', key: 'shift', width: 15 },
//       { header: 'Reports To (User ID)', key: 'reports_to', width: 20 },
//     ];

//     // Add data validation for the 'Gender' column
//     worksheet.dataValidations.add('H2:H1000', {
//       type: 'list',
//       allowBlank: true,
//       formulae: ['"Male,Female"'],
//       showErrorMessage: true,
//       errorTitle: 'Invalid Gender',
//       error: 'Please select a valid gender from the list.'
//     });

//     // Set the response headers to trigger a file download
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
//   }
// };

// module.exports = { generateUserUploadTemplate };


const ExcelJS = require('exceljs');
const { pool } = require('../../db/connector');

/**
 * @description Generates and sends an Excel template for bulk user uploads,
 * including a reference sheet with IDs and dropdowns for roles, jobs, shifts, and users.
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

    const [
        [roles],
        [jobs],
        [shifts],
        [users]
    ] = await Promise.all([rolesPromise, jobsPromise, shiftsPromise, usersPromise]);


    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');
    const referenceSheet = workbook.addWorksheet('Reference Data');

    // --- 2. Populate the main 'Users' worksheet ---
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'Date of Birth (YYYY-MM-DD)', key: 'dob', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Password', key: 'password', width: 20 },
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
    ];

    // --- 3. Populate the 'Reference Data' worksheet ---
    referenceSheet.columns = [
        { header: 'Type', key: 'type', width: 25 },
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Name', key: 'name', width: 35 },
        { header: 'Dropdown Value', key: 'dropdown', width: 40 }, // New column for combined value
    ];
    
    let currentRow = 2;
    // Add Roles and track row numbers
    referenceSheet.getCell('A1').value = 'Roles';
    referenceSheet.getCell('A1').font = { bold: true };
    const rolesStartRow = currentRow;
    roles.forEach(role => {
        referenceSheet.addRow(['', role.id, role.name, `${role.id} - ${role.name}`])
    });
    currentRow += roles.length;
    const rolesEndRow = currentRow -1;
    currentRow++;

    // Add Jobs and track row numbers
    referenceSheet.getCell(`A${currentRow}`).value = 'Jobs';
    referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;
    const jobsStartRow = currentRow;
    jobs.forEach(job => {
        referenceSheet.addRow(['', job.id, job.title, `${job.id} - ${job.title}`])
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
        referenceSheet.addRow(['', shift.id, shift.name, `${shift.id} - ${shift.name}`])
    });
    currentRow += shifts.length;
    const shiftsEndRow = currentRow-1;
    currentRow++;

    // Add Users and track row numbers
    referenceSheet.getCell(`A${currentRow}`).value = 'Users (for Reports To)';
    referenceSheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;
    const usersStartRow = currentRow;
    users.forEach(user => {
        referenceSheet.addRow(['', user.id, user.name, `${user.id} - ${user.name}`])
    });
    currentRow += users.length;
    const usersEndRow = currentRow-1;
    
    // --- 4. Add Data Validations (Dropdowns) to the 'Users' sheet ---
    const maxRows = 1000; // Apply validation for the next 1000 rows
    worksheet.dataValidations.add(`H2:H${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: ['"Male,Female"'],
    });
    worksheet.dataValidations.add(`N2:N${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${rolesStartRow}:$D$${rolesEndRow}`]
    });
    worksheet.dataValidations.add(`O2:O${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${jobsStartRow}:$D$${jobsEndRow}`]
    });
    worksheet.dataValidations.add(`P2:P${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${shiftsStartRow}:$D$${shiftsEndRow}`]
    });
    worksheet.dataValidations.add(`Q2:Q${maxRows}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`'Reference Data'!$D$${usersStartRow}:$D$${usersEndRow}`]
    });


    // --- 5. Send the file ---
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