// utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatDate, formatDateTime, formatCurrency, ensureTempDirectory } = require('./reportHelpers');

/**
 * PDF Generation Utility Class
 * Provides standardized PDF generation functions for HRMS reports
 */
class PDFGenerator {
  constructor(options = {}) {
    this.options = {
      margin: 50,
      layout: options.layout || 'portrait',
      size: options.size || 'A4',
      ...options
    };
    
    this.doc = new PDFDocument(this.options);
    this.currentY = this.options.margin;
    this.pageHeight = this.doc.page.height - (this.options.margin * 2);
    this.pageWidth = this.doc.page.width - (this.options.margin * 2);
  }

  /**
   * Initialize PDF document with file stream
   */
  initializeDocument(fileName) {
    const filePath = path.join(ensureTempDirectory(), fileName);
    this.doc.pipe(fs.createWriteStream(filePath));
    return filePath;
  }

  /**
   * Add company header with logo and details
   */
  addCompanyHeader(companyInfo = {}) {
    const {
      name = 'Human Resource Management System',
      address = '',
      phone = '',
      email = '',
      website = ''
    } = companyInfo;

    // Company name
    this.doc.fontSize(24).font('Helvetica-Bold')
       .text(name, this.options.margin, this.currentY, { align: 'center' });
    
    this.currentY += 30;

    // Company details
    if (address || phone || email) {
      this.doc.fontSize(10).font('Helvetica');
      
      if (address) {
        this.doc.text(address, { align: 'center' });
        this.currentY += 12;
      }
      
      const contactInfo = [phone, email, website].filter(Boolean).join(' | ');
      if (contactInfo) {
        this.doc.text(contactInfo, { align: 'center' });
        this.currentY += 12;
      }
    }

    // Add separator line
    this.doc.moveTo(this.options.margin, this.currentY)
       .lineTo(this.doc.page.width - this.options.margin, this.currentY)
       .stroke('#cccccc');
    
    this.currentY += 20;
    return this;
  }

  /**
   * Add report title and subtitle
   */
  addReportTitle(title, subtitle = '', options = {}) {
    const {
      titleSize = 20,
      subtitleSize = 14,
      spacing = 20
    } = options;

    this.doc.fontSize(titleSize).font('Helvetica-Bold')
       .text(title, { align: 'center' });
    
    this.currentY = this.doc.y + 10;

    if (subtitle) {
      this.doc.fontSize(subtitleSize).font('Helvetica')
         .text(subtitle, { align: 'center' });
      this.currentY = this.doc.y + 10;
    }

    this.currentY += spacing;
    return this;
  }

  /**
   * Add section header
   */
  addSectionHeader(text, options = {}) {
    const {
      fontSize = 16,
      color = '#000000',
      spacing = 15,
      underline = true
    } = options;

    this.checkPageBreak(30);

    this.doc.fontSize(fontSize).font('Helvetica-Bold')
       .fillColor(color)
       .text(text, this.options.margin, this.currentY);

    if (underline) {
      const textWidth = this.doc.widthOfString(text);
      this.doc.moveTo(this.options.margin, this.currentY + fontSize + 2)
         .lineTo(this.options.margin + textWidth, this.currentY + fontSize + 2)
         .stroke();
    }

    this.currentY += fontSize + spacing;
    this.doc.fillColor('#000000'); // Reset color
    return this;
  }

  /**
   * Add summary statistics section
   */
  addSummarySection(title, statistics, options = {}) {
    const {
      titleSize = 16,
      itemSize = 12,
      columns = 2,
      spacing = 15
    } = options;

    this.addSectionHeader(title, { fontSize: titleSize });

    const itemsPerColumn = Math.ceil(statistics.length / columns);
    const columnWidth = this.pageWidth / columns;

    statistics.forEach((stat, index) => {
      const column = Math.floor(index / itemsPerColumn);
      const row = index % itemsPerColumn;
      
      const x = this.options.margin + (column * columnWidth);
      const y = this.currentY + (row * (itemSize + 5));

      this.doc.fontSize(itemSize).font('Helvetica')
         .text(`${stat.label}: ${stat.value}`, x, y, { width: columnWidth - 10 });
    });

    this.currentY += Math.ceil(statistics.length / columns) * (itemSize + 5) + spacing;
    return this;
  }

  /**
   * Create a data table with headers and rows
   */
  addTable(data, options = {}) {
    const {
      headers = [],
      rows = [],
      columnWidths = null,
      headerStyle = { fontSize: 10, font: 'Helvetica-Bold', fillColor: '#f0f0f0' },
      rowStyle = { fontSize: 9, font: 'Helvetica' },
      alternateRowColor = '#f9f9f9',
      borderColor = '#cccccc',
      maxRowsPerPage = 25
    } = options;

    if (!headers.length || !rows.length) return this;

    // Calculate column widths
    const totalWidth = this.pageWidth - 20;
    const colWidths = columnWidths || headers.map(() => totalWidth / headers.length);

    // Draw table header
    this.drawTableHeader(headers, colWidths, headerStyle, borderColor);

    // Draw table rows
    let rowIndex = 0;
    for (const row of rows) {
      if (rowIndex >= maxRowsPerPage) {
        this.doc.addPage();
        this.currentY = this.options.margin;
        this.drawTableHeader(headers, colWidths, headerStyle, borderColor);
        rowIndex = 0;
      }

      this.drawTableRow(row, colWidths, rowStyle, rowIndex % 2 === 1 ? alternateRowColor : null, borderColor);
      rowIndex++;
    }

    this.currentY += 20;
    return this;
  }

  /**
   * Draw table header
   */
  drawTableHeader(headers, colWidths, style, borderColor) {
    this.checkPageBreak(30);

    const startY = this.currentY;
    const rowHeight = 25;

    // Draw header background
    if (style.fillColor) {
      this.doc.rect(this.options.margin, startY, this.pageWidth - 20, rowHeight)
         .fillAndStroke(style.fillColor, borderColor);
    }

    // Draw header text
    let currentX = this.options.margin + 5;
    headers.forEach((header, index) => {
      this.doc.fontSize(style.fontSize).font(style.font)
         .fillColor('#000000')
         .text(header, currentX, startY + 5, {
           width: colWidths[index] - 10,
           align: 'center',
           ellipsis: true
         });
      currentX += colWidths[index];
    });

    this.currentY += rowHeight;
  }

  /**
   * Draw table row
   */
  drawTableRow(rowData, colWidths, style, backgroundColor, borderColor) {
    this.checkPageBreak(20);

    const startY = this.currentY;
    const rowHeight = 18;

    // Draw row background
    if (backgroundColor) {
      this.doc.rect(this.options.margin, startY, this.pageWidth - 20, rowHeight)
         .fillAndStroke(backgroundColor, borderColor);
    }

    // Draw row text
    let currentX = this.options.margin + 5;
    rowData.forEach((cell, index) => {
      this.doc.fontSize(style.fontSize).font(style.font)
         .fillColor('#000000')
         .text(String(cell || ''), currentX, startY + 2, {
           width: colWidths[index] - 10,
           align: 'left',
           ellipsis: true
         });
      currentX += colWidths[index];
    });

    // Draw row border
    this.doc.rect(this.options.margin, startY, this.pageWidth - 20, rowHeight)
       .stroke(borderColor);

    this.currentY += rowHeight;
  }

  /**
   * Add key-value pairs section
   */
  addKeyValueSection(data, options = {}) {
    const {
      title = '',
      fontSize = 12,
      spacing = 15,
      columns = 2
    } = options;

    if (title) {
      this.addSectionHeader(title);
    }

    const itemsPerColumn = Math.ceil(data.length / columns);
    const columnWidth = this.pageWidth / columns;

    data.forEach((item, index) => {
      const column = Math.floor(index / itemsPerColumn);
      const row = index % itemsPerColumn;
      
      const x = this.options.margin + (column * columnWidth);
      const y = this.currentY + (row * (fontSize + 8));

      this.doc.fontSize(fontSize).font('Helvetica-Bold')
         .text(`${item.key}:`, x, y, { width: columnWidth * 0.4 });
      
      this.doc.font('Helvetica')
         .text(String(item.value), x + (columnWidth * 0.4), y, { width: columnWidth * 0.6 });
    });

    this.currentY += Math.ceil(data.length / columns) * (fontSize + 8) + spacing;
    return this;
  }

  /**
   * Add chart placeholder (for future enhancement)
   */
  addChartPlaceholder(title, width = 400, height = 200) {
    this.checkPageBreak(height + 50);

    // Add chart title
    this.doc.fontSize(14).font('Helvetica-Bold')
       .text(title, { align: 'center' });
    
    this.currentY += 25;

    // Draw placeholder rectangle
    const chartX = (this.doc.page.width - width) / 2;
    this.doc.rect(chartX, this.currentY, width, height)
       .stroke('#cccccc');

    // Add placeholder text
    this.doc.fontSize(12).font('Helvetica')
       .text('Chart visualization would appear here', chartX, this.currentY + height/2, {
         width: width,
         align: 'center'
       });

    this.currentY += height + 20;
    return this;
  }

  /**
   * Add page footer with page numbers and generation info
   */
  addFooter(options = {}) {
    const {
      showPageNumbers = true,
      showGenerationDate = true,
      customText = '',
      fontSize = 8
    } = options;

    const footerY = this.doc.page.height - 30;
    
    this.doc.fontSize(fontSize).font('Helvetica');

    if (showPageNumbers) {
      this.doc.text(`Page ${this.doc.bufferedPageRange().start + 1}`, 
        this.doc.page.width - 100, footerY, { align: 'right' });
    }

    if (showGenerationDate) {
      this.doc.text(`Generated on: ${formatDateTime(new Date())}`, 
        this.options.margin, footerY);
    }

    if (customText) {
      this.doc.text(customText, 
        this.doc.page.width / 2, footerY, { align: 'center' });
    }

    return this;
  }

  /**
   * Add watermark
   */
  addWatermark(text, options = {}) {
    const {
      opacity = 0.1,
      fontSize = 60,
      angle = 45,
      color = '#cccccc'
    } = options;

    const centerX = this.doc.page.width / 2;
    const centerY = this.doc.page.height / 2;

    this.doc.save()
       .translate(centerX, centerY)
       .rotate(angle)
       .fontSize(fontSize)
       .font('Helvetica-Bold')
       .fillColor(color)
       .fillOpacity(opacity)
       .text(text, -200, -20, { align: 'center' });

    this.doc.restore();
    return this;
  }

  /**
   * Check if we need a page break
   */
  checkPageBreak(requiredSpace = 50) {
    if (this.currentY + requiredSpace > this.pageHeight) {
      this.doc.addPage();
      this.currentY = this.options.margin;
    }
  }

  /**
   * Add custom content with callback
   */
  addCustomContent(callback) {
    if (typeof callback === 'function') {
      callback(this.doc, this);
    }
    return this;
  }

  /**
   * Finalize and return the PDF
   */
  finalize() {
    this.doc.end();
    return this;
  }

  /**
   * Get the underlying PDFKit document
   */
  getDocument() {
    return this.doc;
  }
}

/**
 * Quick PDF generation functions for common report types
 */

/**
 * Generate a simple data table PDF
 */
const generateTablePDF = async (data, options = {}) => {
  const {
    title = 'Data Report',
    subtitle = '',
    headers = [],
    rows = [],
    fileName = 'report.pdf',
    companyInfo = {}
  } = options;

  const generator = new PDFGenerator();
  const filePath = generator.initializeDocument(fileName);

  generator
    .addCompanyHeader(companyInfo)
    .addReportTitle(title, subtitle)
    .addTable({ headers, rows })
    .addFooter()
    .finalize();

  return filePath;
};

/**
 * Generate a summary report PDF
 */
const generateSummaryPDF = async (data, options = {}) => {
  const {
    title = 'Summary Report',
    subtitle = '',
    sections = [],
    fileName = 'summary-report.pdf',
    companyInfo = {}
  } = options;

  const generator = new PDFGenerator();
  const filePath = generator.initializeDocument(fileName);

  generator.addCompanyHeader(companyInfo)
           .addReportTitle(title, subtitle);

  sections.forEach(section => {
    if (section.type === 'summary') {
      generator.addSummarySection(section.title, section.data);
    } else if (section.type === 'keyvalue') {
      generator.addKeyValueSection(section.data, { title: section.title });
    } else if (section.type === 'table') {
      generator.addTable(section.data);
    }
  });

  generator.addFooter().finalize();

  return filePath;
};

/**
 * Generate an employee profile PDF
 */
const generateEmployeeProfilePDF = async (employee, options = {}) => {
  const {
    fileName = 'employee-profile.pdf',
    companyInfo = {},
    includePhoto = false
  } = options;

  const generator = new PDFGenerator();
  const filePath = generator.initializeDocument(fileName);

  const personalInfo = [
    { key: 'Employee ID', value: employee.id },
    { key: 'Full Name', value: employee.full_name },
    { key: 'Email', value: employee.email },
    { key: 'Phone', value: employee.phone },
    { key: 'Date of Birth', value: formatDate(employee.dob) },
    { key: 'Gender', value: employee.gender },
    { key: 'Nationality', value: employee.nationality }
  ];

  const employmentInfo = [
    { key: 'Joining Date', value: formatDate(employee.joining_date) },
    { key: 'Job Title', value: employee.job_title },
    { key: 'Department', value: employee.department },
    { key: 'Manager', value: employee.manager_name },
    { key: 'Employment Status', value: employee.is_active ? 'Active' : 'Inactive' },
    { key: 'Probation Status', value: employee.is_probation ? 'On Probation' : 'Confirmed' }
  ];

  generator
    .addCompanyHeader(companyInfo)
    .addReportTitle('Employee Profile', employee.full_name)
    .addKeyValueSection(personalInfo, { title: 'Personal Information' })
    .addKeyValueSection(employmentInfo, { title: 'Employment Information' })
    .addFooter()
    .finalize();

  return filePath;
};

module.exports = {
  PDFGenerator,
  generateTablePDF,
  generateSummaryPDF,
  generateEmployeeProfilePDF
};