// utils/reportHelpers.js
const fs = require('fs');
const path = require('path');

/**
 * Utility functions for report generation
 */

/**
 * @description Ensure temp directory exists
 */
const ensureTempDirectory = () => {
  const tempDir = path.join(__dirname, '../../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
};

/**
 * @description Clean up old report files (files older than 24 hours)
 */
const cleanupOldReports = () => {
  const tempDir = ensureTempDirectory();
  const files = fs.readdirSync(tempDir);
  const now = Date.now();
  
  files.forEach(file => {
    const filePath = path.join(tempDir, file);
    const stats = fs.statSync(filePath);
    const fileAge = now - stats.mtime.getTime();
    
    // Delete files older than 24 hours (86400000 ms)
    if (fileAge > 86400000) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old report file: ${file}`);
      } catch (error) {
        console.error(`Error deleting file ${file}:`, error);
      }
    }
  });
};

/**
 * @description Format date for display
 */
const formatDate = (date) => {
  if (!date) return 'N/A';
  
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};

/**
 * @description Format datetime for display
 */
const formatDateTime = (datetime) => {
  if (!datetime) return 'N/A';
  
  if (typeof datetime === 'string') {
    datetime = new Date(datetime);
  }
  
  return datetime.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * @description Format currency for display
 */
const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return 'N/A';
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return 'N/A';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(numAmount);
};

/**
 * @description Format percentage for display
 */
const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return 'N/A';
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 'N/A';
  
  return `${numValue.toFixed(decimals)}%`;
};

/**
 * @description Truncate text to specified length
 */
const truncateText = (text, maxLength = 50) => {
  if (!text) return 'N/A';
  
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * @description Calculate age from date of birth
 */
const calculateAge = (dob) => {
  if (!dob) return 'N/A';
  
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * @description Calculate tenure in years and months
 */
const calculateTenure = (joiningDate) => {
  if (!joiningDate) return 'N/A';
  
  const today = new Date();
  const joinDate = new Date(joiningDate);
  
  let years = today.getFullYear() - joinDate.getFullYear();
  let months = today.getMonth() - joinDate.getMonth();
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  if (years === 0) {
    return `${months} months`;
  } else if (months === 0) {
    return `${years} years`;
  } else {
    return `${years} years ${months} months`;
  }
};

/**
 * @description Validate date range
 */
const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format');
  }
  
  if (start > end) {
    throw new Error('Start date cannot be after end date');
  }
  
  // Check if date range is too large (more than 2 years)
  const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
  if (daysDiff > 730) {
    throw new Error('Date range cannot exceed 2 years');
  }
  
  return { startDate: start, endDate: end };
};

/**
 * @description Generate standard report metadata
 */
const generateReportMetadata = (reportType, filters, generatedBy) => {
  return {
    reportType,
    generatedAt: new Date().toISOString(),
    generatedBy,
    filters,
    version: '1.0'
  };
};

/**
 * @description Common Excel styling
 */
const applyExcelStyling = (worksheet, headerRowNumber = 1) => {
  const headerRow = worksheet.getRow(headerRowNumber);
  
  // Header styling
  headerRow.font = { 
    bold: true, 
    color: { argb: 'FFFFFF' } 
  };
  headerRow.fill = { 
    type: 'pattern', 
    pattern: 'solid', 
    fgColor: { argb: 'FF366092' } 
  };
  headerRow.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  // Auto-fit columns
  worksheet.columns.forEach(column => {
    if (!column.width) {
      column.width = 15;
    }
  });
  
  // Add borders to all data cells
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > headerRowNumber) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
  });
  
  return worksheet;
};

/**
 * @description Common PDF styling helpers
 */
const pdfHelpers = {
  drawTableHeader: (doc, headers, startX, startY, columnWidth) => {
    headers.forEach((header, i) => {
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#ffffff')
         .rect(startX + i * columnWidth, startY - 5, columnWidth, 20)
         .fill('#366092')
         .fillColor('#ffffff')
         .text(header, startX + i * columnWidth, startY, { 
           width: columnWidth, 
           align: 'center' 
         });
    });
    
    doc.fillColor('#000000'); // Reset color
    return startY + 20;
  },
  
  drawTableRow: (doc, rowData, startX, yPosition, columnWidth, alternateRow = false) => {
    if (alternateRow) {
      doc.fillColor('#f5f5f5')
         .rect(startX, yPosition - 2, columnWidth * rowData.length, 16)
         .fill()
         .fillColor('#000000');
    }
    
    rowData.forEach((cell, i) => {
      doc.fontSize(9).font('Helvetica')
         .text(String(cell), startX + i * columnWidth, yPosition, { 
           width: columnWidth, 
           align: 'center' 
         });
    });
    
    return yPosition + 16;
  },
  
  addPageHeader: (doc, title, subtitle = '') => {
    doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
    if (subtitle) {
      doc.fontSize(14).font('Helvetica').text(subtitle, { align: 'center' });
    }
    doc.moveDown(2);
    return doc.y;
  },
  
  addSection: (doc, sectionTitle) => {
    doc.fontSize(16).font('Helvetica-Bold').text(sectionTitle);
    doc.moveDown();
    return doc.y;
  }
};

/**
 * @description Generate file name with timestamp
 */
const generateFileName = (baseName, format, includeTimestamp = true) => {
  const timestamp = includeTimestamp ? `-${Date.now()}` : '';
  const extension = format === 'excel' ? 'xlsx' : 'pdf';
  return `${baseName}${timestamp}.${extension}`;
};

/**
 * @description Validate report parameters
 */
const validateReportParams = (params) => {
  const errors = [];
  
  // Validate format
  if (params.format && !['pdf', 'excel'].includes(params.format)) {
    errors.push('Format must be either "pdf" or "excel"');
  }
  
  // Validate employee IDs
  if (params.employeeIds && (!Array.isArray(params.employeeIds) || params.employeeIds.some(id => !Number.isInteger(id)))) {
    errors.push('Employee IDs must be an array of integers');
  }
  
  // Validate date range if provided
  if (params.startDate && params.endDate) {
    try {
      validateDateRange(params.startDate, params.endDate);
    } catch (error) {
      errors.push(error.message);
    }
  }
  
  return errors;
};

/**
 * @description Clean up file after download
 */
const scheduleFileCleanup = (filePath, delayMs = 300000) => { // 5 minutes default
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  }, delayMs);
};

module.exports = {
  ensureTempDirectory,
  cleanupOldReports,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPercentage,
  truncateText,
  calculateAge,
  calculateTenure,
  validateDateRange,
  generateReportMetadata,
  applyExcelStyling,
  pdfHelpers,
  generateFileName,
  validateReportParams,
  scheduleFileCleanup
};