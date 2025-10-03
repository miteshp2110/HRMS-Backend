// controllers/reports/employeeReportsController.js
const { pool } = require('../../db/connector');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatDate, formatDateTime, calculateAge, calculateTenure, ensureTempDirectory } = require('../../utils/reportHelpers');

/**
 * @description Generate comprehensive employee directory report
 */
const generateEmployeeDirectoryReport = async (req, res) => {
  const { 
    departments, 
    roles, 
    includeInactive = false, 
    format = 'pdf',
    includeContactInfo = true,
    includeSalaryInfo = false 
  } = req.body;
  
  const requesterId = req.user.id;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Check if requester has salary visibility permissions
    const [requesterInfo] = await connection.query(`
      SELECT salary_visibility FROM user WHERE id = ?
    `, [requesterId]);
    
    const canViewSalary = includeSalaryInfo && requesterInfo[0]?.salary_visibility;
    
    let query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        u.email,
        u.phone,
        u.dob,
        u.gender,
        u.joining_date,
        u.nationality,
        u.is_active,
        u.inactive_date,
        u.is_probation,
        j.title as job_title,
        r.name as role_name,
        s.name as shift_name,
        s.from_time,
        s.to_time,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name,
        u.emergency_contact_name,
        u.emergency_contact_relation,
        u.emergency_contact_number,
        bd.bank_name,
        bd.bank_account,
        bd.bank_ifsc
        ${canViewSalary ? ', ess.value as basic_salary' : ''}
      FROM user u
      JOIN jobs j ON u.job_role = j.id
      JOIN roles r ON u.system_role = r.id
      JOIN shifts s ON u.shift = s.id
      LEFT JOIN user m ON u.reports_to = m.id
      LEFT JOIN bank_details bd ON u.id = bd.user_id
      ${canViewSalary ? 'LEFT JOIN employee_salary_structure ess ON u.id = ess.employee_id AND ess.component_id = 1' : ''}
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    if (!includeInactive) {
      query += ` AND u.is_active = 1`;
    }
    
    if (departments && departments.length > 0) {
      query += ` AND j.id IN (${departments.map(() => '?').join(',')})`;
      queryParams.push(...departments);
    }
    
    if (roles && roles.length > 0) {
      query += ` AND r.id IN (${roles.map(() => '?').join(',')})`;
      queryParams.push(...roles);
    }
    
    query += ` ORDER BY u.first_name, u.last_name`;
    
    const [employeeData] = await connection.query(query, queryParams);
    
    // Get additional statistics
    const [stats] = await connection.query(`
      SELECT 
        COUNT(*) as total_employees,
        SUM(CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END) as active_employees,
        SUM(CASE WHEN u.is_active = 0 THEN 1 ELSE 0 END) as inactive_employees,
        SUM(CASE WHEN u.is_probation = 1 THEN 1 ELSE 0 END) as probation_employees,
        AVG(DATEDIFF(CURDATE(), u.joining_date) / 365) as avg_tenure_years
      FROM user u
      JOIN jobs j ON u.job_role = j.id
      JOIN roles r ON u.system_role = r.id
      WHERE 1=1
      ${!includeInactive ? ' AND u.is_active = 1' : ''}
      ${departments && departments.length > 0 ? ` AND j.id IN (${departments.map(() => '?').join(',')})` : ''}
      ${roles && roles.length > 0 ? ` AND r.id IN (${roles.map(() => '?').join(',')})` : ''}
    `, queryParams);
    
    // Get department breakdown
    const [deptBreakdown] = await connection.query(`
      SELECT 
        j.title as department,
        COUNT(*) as employee_count,
        SUM(CASE WHEN u.is_active = 1 THEN 1 ELSE 0 END) as active_count
      FROM user u
      JOIN jobs j ON u.job_role = j.id
      JOIN roles r ON u.system_role = r.id
      WHERE 1=1
      ${!includeInactive ? ' AND u.is_active = 1' : ''}
      ${departments && departments.length > 0 ? ` AND j.id IN (${departments.map(() => '?').join(',')})` : ''}
      ${roles && roles.length > 0 ? ` AND r.id IN (${roles.map(() => '?').join(',')})` : ''}
      GROUP BY j.id, j.title
      ORDER BY employee_count DESC
    `, queryParams);
    
    const reportData = {
      employees: employeeData,
      statistics: stats[0],
      departmentBreakdown: deptBreakdown,
      options: { includeContactInfo, includeSalaryInfo: canViewSalary, includeInactive }
    };
    
    if (format === 'excel') {
      const filePath = await generateEmployeeDirectoryExcel(reportData);
      res.download(filePath, `employee-directory-${Date.now()}.xlsx`);
    } else {
      const filePath = await generateEmployeeDirectoryPDF(reportData);
      res.download(filePath, `employee-directory-${Date.now()}.pdf`);
    }
    
  } catch (error) {
    console.error('Error generating employee directory report:', error);
    res.status(500).json({ message: 'An error occurred while generating the report.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Generate employee demographics and analytics report
 */
const generateEmployeeDemographicsReport = async (req, res) => {
  const { format = 'pdf' } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Age distribution
    const [ageDistribution] = await connection.query(`
      SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) < 25 THEN 'Under 25'
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 25 AND 34 THEN '25-34'
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 35 AND 44 THEN '35-44'
          WHEN TIMESTAMPDIFF(YEAR, dob, CURDATE()) BETWEEN 45 AND 54 THEN '45-54'
          ELSE '55+'
        END as age_group,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user WHERE is_active = 1)), 2) as percentage
      FROM user 
      WHERE is_active = 1 AND dob IS NOT NULL
      GROUP BY age_group
      ORDER BY 
        CASE age_group
          WHEN 'Under 25' THEN 1
          WHEN '25-34' THEN 2
          WHEN '35-44' THEN 3
          WHEN '45-54' THEN 4
          ELSE 5
        END
    `);
    
    // Gender distribution
    const [genderDistribution] = await connection.query(`
      SELECT 
        gender,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user WHERE is_active = 1)), 2) as percentage
      FROM user 
      WHERE is_active = 1
      GROUP BY gender
      ORDER BY count DESC
    `);
    
    // Tenure distribution
    const [tenureDistribution] = await connection.query(`
      SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) < 1 THEN 'Less than 1 year'
          WHEN TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) BETWEEN 1 AND 2 THEN '1-2 years'
          WHEN TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) BETWEEN 3 AND 5 THEN '3-5 years'
          WHEN TIMESTAMPDIFF(YEAR, joining_date, CURDATE()) BETWEEN 6 AND 10 THEN '6-10 years'
          ELSE 'More than 10 years'
        END as tenure_group,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user WHERE is_active = 1)), 2) as percentage
      FROM user 
      WHERE is_active = 1
      GROUP BY tenure_group
      ORDER BY 
        CASE tenure_group
          WHEN 'Less than 1 year' THEN 1
          WHEN '1-2 years' THEN 2
          WHEN '3-5 years' THEN 3
          WHEN '6-10 years' THEN 4
          ELSE 5
        END
    `);
    
    // Department distribution
    const [departmentDistribution] = await connection.query(`
      SELECT 
        j.title as department,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user WHERE is_active = 1)), 2) as percentage
      FROM user u
      JOIN jobs j ON u.job_role = j.id
      WHERE u.is_active = 1
      GROUP BY j.id, j.title
      ORDER BY count DESC
    `);
    
    // Role distribution
    const [roleDistribution] = await connection.query(`
      SELECT 
        r.name as role,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user WHERE is_active = 1)), 2) as percentage
      FROM user u
      JOIN roles r ON u.system_role = r.id
      WHERE u.is_active = 1
      GROUP BY r.id, r.name
      ORDER BY count DESC
    `);
    
    // Nationality distribution
    const [nationalityDistribution] = await connection.query(`
      SELECT 
        COALESCE(nationality, 'Not Specified') as nationality,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user WHERE is_active = 1)), 2) as percentage
      FROM user 
      WHERE is_active = 1
      GROUP BY nationality
      ORDER BY count DESC
      LIMIT 10
    `);
    
    const reportData = {
      ageDistribution,
      genderDistribution,
      tenureDistribution,
      departmentDistribution,
      roleDistribution,
      nationalityDistribution
    };
    
    if (format === 'excel') {
      const filePath = await generateDemographicsExcel(reportData);
      res.download(filePath, `employee-demographics-${Date.now()}.xlsx`);
    } else {
      const filePath = await generateDemographicsPDF(reportData);
      res.download(filePath, `employee-demographics-${Date.now()}.pdf`);
    }
    
  } catch (error) {
    console.error('Error generating demographics report:', error);
    res.status(500).json({ message: 'An error occurred while generating the report.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Generate probation status report
 */
const generateProbationReport = async (req, res) => {
  const { format = 'pdf', includePastProbation = false } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    let query = `
      SELECT 
        u.id as employee_id,
        CONCAT(u.first_name, ' ', u.last_name) as employee_name,
        u.email,
        j.title as job_title,
        u.joining_date,
        u.is_probation,
        u.probation_end_date,
        DATEDIFF(CURDATE(), u.joining_date) as days_since_joining,
        CASE 
          WHEN u.is_probation = 1 AND u.probation_end_date IS NOT NULL THEN DATEDIFF(u.probation_end_date, CURDATE())
          ELSE NULL
        END as days_to_probation_end,
        CONCAT(m.first_name, ' ', m.last_name) as manager_name
      FROM user u
      JOIN jobs j ON u.job_role = j.id
      LEFT JOIN user m ON u.reports_to = m.id
      WHERE u.is_active = 1
    `;
    
    if (!includePastProbation) {
      query += ` AND u.is_probation = 1`;
    }
    
    query += ` ORDER BY u.joining_date DESC, u.first_name, u.last_name`;
    
    const [probationData] = await connection.query(query);
    
    // Calculate statistics
    const summary = {
      total_employees: probationData.length,
      on_probation: probationData.filter(e => e.is_probation === 1).length,
      completed_probation: probationData.filter(e => e.is_probation === 0).length,
      probation_ending_soon: probationData.filter(e => 
        e.is_probation === 1 && e.days_to_probation_end !== null && e.days_to_probation_end <= 30
      ).length,
      overdue_probation: probationData.filter(e => 
        e.is_probation === 1 && e.days_to_probation_end !== null && e.days_to_probation_end < 0
      ).length
    };
    
    const reportData = {
      probationEmployees: probationData,
      summary,
      options: { includePastProbation }
    };
    
    if (format === 'excel') {
      const filePath = await generateProbationExcel(reportData);
      res.download(filePath, `probation-report-${Date.now()}.xlsx`);
    } else {
      const filePath = await generateProbationPDF(reportData);
      res.download(filePath, `probation-report-${Date.now()}.pdf`);
    }
    
  } catch (error) {
    console.error('Error generating probation report:', error);
    res.status(500).json({ message: 'An error occurred while generating the report.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Generate skill matrix report
 */
const generateSkillMatrixReport = async (req, res) => {
  const { employeeIds, skillIds, format = 'excel' } = req.body;
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Note: This assumes you have employee_skills and skills tables
    // Adjust based on your actual schema
    let query = `
      SELECT 
        u.id as employee_id,
        CONCAT(u.first_name, ' ', u.last_name) as employee_name,
        j.title as job_title,
        s.name as skill_name,
        s.category as skill_category,
        es.proficiency_level,
        es.years_experience,
        es.last_updated,
        es.verified_by
      FROM user u
      JOIN jobs j ON u.job_role = j.id
      LEFT JOIN employee_skills es ON u.id = es.employee_id
      LEFT JOIN skills s ON es.skill_id = s.id
      WHERE u.is_active = 1
    `;
    
    const queryParams = [];
    
    if (employeeIds && employeeIds.length > 0) {
      query += ` AND u.id IN (${employeeIds.map(() => '?').join(',')})`;
      queryParams.push(...employeeIds);
    }
    
    if (skillIds && skillIds.length > 0) {
      query += ` AND s.id IN (${skillIds.map(() => '?').join(',')})`;
      queryParams.push(...skillIds);
    }
    
    query += ` ORDER BY u.first_name, u.last_name, s.category, s.name`;
    
    const [skillData] = await connection.query(query, queryParams);
    
    if (format === 'excel') {
      const filePath = await generateSkillMatrixExcel(skillData);
      res.download(filePath, `skill-matrix-report-${Date.now()}.xlsx`);
    } else {
      const filePath = await generateSkillMatrixPDF(skillData);
      res.download(filePath, `skill-matrix-report-${Date.now()}.pdf`);
    }
    
  } catch (error) {
    console.error('Error generating skill matrix report:', error);
    res.status(500).json({ message: 'An error occurred while generating the report.' });
  } finally {
    if (connection) connection.release();
  }
};

// Helper functions for Excel and PDF generation
const generateEmployeeDirectoryExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['EMPLOYEE DIRECTORY SUMMARY']);
  summarySheet.addRow([]);
  
  // Statistics
  summarySheet.addRow(['STATISTICS']);
  summarySheet.addRow(['Total Employees', data.statistics.total_employees]);
  summarySheet.addRow(['Active Employees', data.statistics.active_employees]);
  summarySheet.addRow(['Inactive Employees', data.statistics.inactive_employees]);
  summarySheet.addRow(['Employees on Probation', data.statistics.probation_employees]);
  summarySheet.addRow(['Average Tenure (Years)', parseFloat(data.statistics.avg_tenure_years || 0).toFixed(2)]);
  summarySheet.addRow([]);
  
  // Department breakdown
  summarySheet.addRow(['DEPARTMENT BREAKDOWN']);
  summarySheet.addRow(['Department', 'Total Employees', 'Active Employees']);
  
  data.departmentBreakdown.forEach(dept => {
    summarySheet.addRow([dept.department, dept.employee_count, dept.active_count]);
  });
  
  // Employee details sheet
  const employeeSheet = workbook.addWorksheet('Employee Details');
  
  // Build headers based on options
  const headers = [
    'Employee ID', 'Full Name', 'Job Title', 'Role', 'Gender', 'Date of Birth',
    'Age', 'Joining Date', 'Tenure', 'Nationality', 'Status', 'Probation', 'Shift', 'Manager'
  ];
  
  if (data.options.includeContactInfo) {
    headers.push('Email', 'Phone', 'Emergency Contact', 'Emergency Relation', 'Emergency Phone');
  }
  
  if (data.options.includeSalaryInfo) {
    headers.push('Basic Salary', 'Bank Name', 'Account Number', 'IFSC Code');
  }
  
  employeeSheet.addRow(headers);
  
  // Add employee data
  data.employees.forEach(emp => {
    const row = [
      emp.id,
      emp.full_name,
      emp.job_title,
      emp.role_name,
      emp.gender,
      formatDate(emp.dob),
      calculateAge(emp.dob),
      formatDate(emp.joining_date),
      calculateTenure(emp.joining_date),
      emp.nationality || 'N/A',
      emp.is_active ? 'Active' : 'Inactive',
      emp.is_probation ? 'Yes' : 'No',
      `${emp.shift_name} (${emp.from_time}-${emp.to_time})`,
      emp.manager_name || 'N/A'
    ];
    
    if (data.options.includeContactInfo) {
      row.push(
        emp.email,
        emp.phone,
        emp.emergency_contact_name,
        emp.emergency_contact_relation,
        emp.emergency_contact_number
      );
    }
    
    if (data.options.includeSalaryInfo) {
      row.push(
        emp.basic_salary ? parseFloat(emp.basic_salary).toFixed(2) : 'N/A',
        emp.bank_name || 'N/A',
        emp.bank_account || 'N/A',
        emp.bank_ifsc || 'N/A'
      );
    }
    
    employeeSheet.addRow(row);
  });
  
  // Style the worksheets
  summarySheet.getRow(1).font = { bold: true, size: 16 };
  summarySheet.getRow(3).font = { bold: true, size: 14 };
  summarySheet.getRow(9).font = { bold: true, size: 14 };
  
  const employeeHeaderRow = employeeSheet.getRow(1);
  employeeHeaderRow.font = { bold: true };
  employeeHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  
  // Auto-fit columns
  [summarySheet, employeeSheet].forEach(sheet => {
    sheet.columns.forEach(column => {
      column.width = 15;
    });
  });
  
  const fileName = `employee-directory-${Date.now()}.xlsx`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

const generateEmployeeDirectoryPDF = async (data) => {
  const doc = new PDFDocument({ margin: 50 });
  const fileName = `employee-directory-${Date.now()}.pdf`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  doc.pipe(fs.createWriteStream(filePath));
  
  // Title
  doc.fontSize(20).font('Helvetica-Bold').text('EMPLOYEE DIRECTORY', { align: 'center' });
  doc.moveDown(2);
  
  // Statistics section
  doc.fontSize(16).font('Helvetica-Bold').text('STATISTICS');
  doc.moveDown();
  
  const stats = [
    ['Total Employees:', data.statistics.total_employees],
    ['Active Employees:', data.statistics.active_employees],
    ['Inactive Employees:', data.statistics.inactive_employees],
    ['Employees on Probation:', data.statistics.probation_employees],
    ['Average Tenure:', `${parseFloat(data.statistics.avg_tenure_years || 0).toFixed(2)} years`]
  ];
  
  stats.forEach(([label, value]) => {
    doc.fontSize(12).font('Helvetica').text(`${label} ${value}`);
  });
  
  // Department breakdown
  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('DEPARTMENT BREAKDOWN');
  doc.moveDown();
  
  data.departmentBreakdown.forEach(dept => {
    doc.fontSize(12).font('Helvetica').text(
      `${dept.department}: ${dept.employee_count} total (${dept.active_count} active)`
    );
  });
  
  // Employee list
  doc.addPage();
  doc.fontSize(16).font('Helvetica-Bold').text('EMPLOYEE LIST');
  doc.moveDown();
  
  const tableTop = doc.y;
  const headers = ['Name', 'Job Title', 'Role', 'Status', 'Manager'];
  const columnWidth = 100;
  
  headers.forEach((header, i) => {
    doc.fontSize(10).font('Helvetica-Bold')
       .text(header, 50 + i * columnWidth, tableTop, { width: columnWidth, align: 'center' });
  });
  
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
  
  let yPosition = tableTop + 25;
  
  data.employees.slice(0, 30).forEach((emp, index) => { // Limit to first 30 for PDF
    if (yPosition > 700) {
      doc.addPage();
      yPosition = 50;
    }
    
    const rowData = [
      emp.full_name.substring(0, 15),
      emp.job_title.substring(0, 12),
      emp.role_name.substring(0, 10),
      emp.is_active ? 'Active' : 'Inactive',
      (emp.manager_name || 'N/A').substring(0, 12)
    ];
    
    rowData.forEach((cell, i) => {
      doc.fontSize(9).font('Helvetica')
         .text(cell, 50 + i * columnWidth, yPosition, { width: columnWidth, align: 'center' });
    });
    
    yPosition += 18;
  });
  
  if (data.employees.length > 30) {
    doc.moveDown().fontSize(10).font('Helvetica-Oblique')
       .text(`... and ${data.employees.length - 30} more employees. Use Excel format for complete data.`);
  }
  
  doc.end();
  return filePath;
};

const generateDemographicsExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  
  // Age distribution sheet
  const ageSheet = workbook.addWorksheet('Age Distribution');
  ageSheet.addRow(['EMPLOYEE AGE DISTRIBUTION']);
  ageSheet.addRow([]);
  ageSheet.addRow(['Age Group', 'Count', 'Percentage']);
  
  data.ageDistribution.forEach(record => {
    ageSheet.addRow([record.age_group, record.count, `${record.percentage}%`]);
  });
  
  // Gender distribution sheet
  const genderSheet = workbook.addWorksheet('Gender Distribution');
  genderSheet.addRow(['EMPLOYEE GENDER DISTRIBUTION']);
  genderSheet.addRow([]);
  genderSheet.addRow(['Gender', 'Count', 'Percentage']);
  
  data.genderDistribution.forEach(record => {
    genderSheet.addRow([record.gender, record.count, `${record.percentage}%`]);
  });
  
  // Tenure distribution sheet
  const tenureSheet = workbook.addWorksheet('Tenure Distribution');
  tenureSheet.addRow(['EMPLOYEE TENURE DISTRIBUTION']);
  tenureSheet.addRow([]);
  tenureSheet.addRow(['Tenure Group', 'Count', 'Percentage']);
  
  data.tenureDistribution.forEach(record => {
    tenureSheet.addRow([record.tenure_group, record.count, `${record.percentage}%`]);
  });
  
  // Department distribution sheet
  const deptSheet = workbook.addWorksheet('Department Distribution');
  deptSheet.addRow(['DEPARTMENT DISTRIBUTION']);
  deptSheet.addRow([]);
  deptSheet.addRow(['Department', 'Count', 'Percentage']);
  
  data.departmentDistribution.forEach(record => {
    deptSheet.addRow([record.department, record.count, `${record.percentage}%`]);
  });
  
  // Style all worksheets
  [ageSheet, genderSheet, tenureSheet, deptSheet].forEach(sheet => {
    sheet.getRow(1).font = { bold: true, size: 16 };
    const headerRow = sheet.getRow(3);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    
    sheet.columns.forEach(column => {
      column.width = 20;
    });
  });
  
  const fileName = `employee-demographics-${Date.now()}.xlsx`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

const generateDemographicsPDF = async (data) => {
  const doc = new PDFDocument({ margin: 50 });
  const fileName = `employee-demographics-${Date.now()}.pdf`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  doc.pipe(fs.createWriteStream(filePath));
  
  // Title
  doc.fontSize(20).font('Helvetica-Bold').text('EMPLOYEE DEMOGRAPHICS REPORT', { align: 'center' });
  doc.moveDown(2);
  
  // Age Distribution
  doc.fontSize(16).font('Helvetica-Bold').text('AGE DISTRIBUTION');
  doc.moveDown();
  
  data.ageDistribution.forEach(record => {
    doc.fontSize(12).font('Helvetica').text(`${record.age_group}: ${record.count} (${record.percentage}%)`);
  });
  
  // Gender Distribution
  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('GENDER DISTRIBUTION');
  doc.moveDown();
  
  data.genderDistribution.forEach(record => {
    doc.fontSize(12).font('Helvetica').text(`${record.gender}: ${record.count} (${record.percentage}%)`);
  });
  
  // Tenure Distribution
  doc.moveDown();
  doc.fontSize(14).font('Helvetica-Bold').text('TENURE DISTRIBUTION');
  doc.moveDown();
  
  data.tenureDistribution.forEach(record => {
    doc.fontSize(12).font('Helvetica').text(`${record.tenure_group}: ${record.count} (${record.percentage}%)`);
  });
  
  // Department Distribution
  doc.addPage();
  doc.fontSize(16).font('Helvetica-Bold').text('DEPARTMENT DISTRIBUTION');
  doc.moveDown();
  
  data.departmentDistribution.forEach(record => {
    doc.fontSize(12).font('Helvetica').text(`${record.department}: ${record.count} (${record.percentage}%)`);
  });
  
  doc.end();
  return filePath;
};

const generateProbationExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  
  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['PROBATION STATUS REPORT']);
  summarySheet.addRow([]);
  
  summarySheet.addRow(['SUMMARY']);
  summarySheet.addRow(['Total Employees', data.summary.total_employees]);
  summarySheet.addRow(['On Probation', data.summary.on_probation]);
  summarySheet.addRow(['Completed Probation', data.summary.completed_probation]);
  summarySheet.addRow(['Probation Ending Soon (30 days)', data.summary.probation_ending_soon]);
  summarySheet.addRow(['Overdue Probation', data.summary.overdue_probation]);
  summarySheet.addRow([]);
  
  // Details sheet
  const detailsSheet = workbook.addWorksheet('Probation Details');
  detailsSheet.addRow([
    'Employee Name', 'Email', 'Job Title', 'Joining Date', 'Days Since Joining',
    'Probation Status', 'Probation End Date', 'Days to End', 'Manager'
  ]);
  
  data.probationEmployees.forEach(emp => {
    detailsSheet.addRow([
      emp.employee_name,
      emp.email,
      emp.job_title,
      formatDate(emp.joining_date),
      emp.days_since_joining,
      emp.is_probation ? 'On Probation' : 'Completed',
      formatDate(emp.probation_end_date),
      emp.days_to_probation_end || 'N/A',
      emp.manager_name || 'N/A'
    ]);
  });
  
  // Style worksheets
  summarySheet.getRow(1).font = { bold: true, size: 16 };
  summarySheet.getRow(3).font = { bold: true, size: 14 };
  
  const detailsHeaderRow = detailsSheet.getRow(1);
  detailsHeaderRow.font = { bold: true };
  detailsHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  
  [summarySheet, detailsSheet].forEach(sheet => {
    sheet.columns.forEach(column => {
      column.width = 15;
    });
  });
  
  const fileName = `probation-report-${Date.now()}.xlsx`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

const generateProbationPDF = async (data) => {
  const doc = new PDFDocument({ margin: 50 });
  const fileName = `probation-report-${Date.now()}.pdf`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  doc.pipe(fs.createWriteStream(filePath));
  
  // Title
  doc.fontSize(20).font('Helvetica-Bold').text('PROBATION STATUS REPORT', { align: 'center' });
  doc.moveDown(2);
  
  // Summary
  doc.fontSize(16).font('Helvetica-Bold').text('SUMMARY');
  doc.moveDown();
  
  const summaryItems = [
    ['Total Employees:', data.summary.total_employees],
    ['On Probation:', data.summary.on_probation],
    ['Completed Probation:', data.summary.completed_probation],
    ['Probation Ending Soon:', data.summary.probation_ending_soon],
    ['Overdue Probation:', data.summary.overdue_probation]
  ];
  
  summaryItems.forEach(([label, value]) => {
    doc.fontSize(12).font('Helvetica').text(`${label} ${value}`);
  });
  
  // Details table
  if (data.probationEmployees.length > 0) {
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('PROBATION DETAILS');
    doc.moveDown();
    
    const tableTop = doc.y;
    const headers = ['Employee', 'Job Title', 'Joining Date', 'Status', 'Days to End'];
    const columnWidth = 100;
    
    headers.forEach((header, i) => {
      doc.fontSize(10).font('Helvetica-Bold')
         .text(header, 50 + i * columnWidth, tableTop, { width: columnWidth, align: 'center' });
    });
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    
    let yPosition = tableTop + 25;
    
    data.probationEmployees.slice(0, 25).forEach((emp, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      const rowData = [
        emp.employee_name.substring(0, 15),
        emp.job_title.substring(0, 12),
        formatDate(emp.joining_date),
        emp.is_probation ? 'On Probation' : 'Completed',
        emp.days_to_probation_end || 'N/A'
      ];
      
      rowData.forEach((cell, i) => {
        doc.fontSize(9).font('Helvetica')
           .text(cell, 50 + i * columnWidth, yPosition, { width: columnWidth, align: 'center' });
      });
      
      yPosition += 18;
    });
    
    if (data.probationEmployees.length > 25) {
      doc.moveDown().fontSize(10).font('Helvetica-Oblique')
         .text(`... and ${data.probationEmployees.length - 25} more employees.`);
    }
  }
  
  doc.end();
  return filePath;
};

const generateSkillMatrixExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Skill Matrix');
  
  worksheet.addRow(['EMPLOYEE SKILL MATRIX']);
  worksheet.addRow([`Generated on: ${formatDate(new Date())}`]);
  worksheet.addRow([]);
  
  const headers = [
    'Employee Name', 'Job Title', 'Skill Name', 'Skill Category',
    'Proficiency Level', 'Years Experience', 'Last Updated', 'Verified By'
  ];
  
  worksheet.addRow(headers);
  
  data.forEach(record => {
    worksheet.addRow([
      record.employee_name,
      record.job_title,
      record.skill_name || 'N/A',
      record.skill_category || 'N/A',
      record.proficiency_level || 'N/A',
      record.years_experience || 0,
      formatDate(record.last_updated),
      record.verified_by || 'N/A'
    ]);
  });
  
  // Style the worksheet
  worksheet.getRow(1).font = { bold: true, size: 16 };
  const headerRow = worksheet.getRow(4);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  
  worksheet.columns.forEach(column => {
    column.width = 15;
  });
  
  const fileName = `skill-matrix-${Date.now()}.xlsx`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

const generateSkillMatrixPDF = async (data) => {
  const doc = new PDFDocument({ margin: 50, layout: 'landscape' });
  const fileName = `skill-matrix-${Date.now()}.pdf`;
  const filePath = path.join(ensureTempDirectory(), fileName);
  
  doc.pipe(fs.createWriteStream(filePath));
  
  // Title
  doc.fontSize(20).font('Helvetica-Bold').text('EMPLOYEE SKILL MATRIX', { align: 'center' });
  doc.fontSize(12).text(`Generated on: ${formatDate(new Date())}`, { align: 'center' });
  doc.moveDown(2);
  
  // Group by employee
  const employeeSkills = {};
  data.forEach(record => {
    if (!employeeSkills[record.employee_name]) {
      employeeSkills[record.employee_name] = {
        job_title: record.job_title,
        skills: []
      };
    }
    if (record.skill_name) {
      employeeSkills[record.employee_name].skills.push(record);
    }
  });
  
  Object.entries(employeeSkills).forEach(([employeeName, empData]) => {
    if (doc.y > 600) {
      doc.addPage();
    }
    
    doc.fontSize(14).font('Helvetica-Bold').text(`${employeeName} - ${empData.job_title}`);
    doc.moveDown(0.5);
    
    empData.skills.forEach(skill => {
      doc.fontSize(10).font('Helvetica')
         .text(`${skill.skill_name} (${skill.skill_category}): ${skill.proficiency_level} - ${skill.years_experience} years`);
    });
    
    doc.moveDown();
  });
  
  doc.end();
  return filePath;
};

module.exports = {
  generateEmployeeDirectoryReport,
  generateEmployeeDemographicsReport,
  generateProbationReport,
  generateSkillMatrixReport
};