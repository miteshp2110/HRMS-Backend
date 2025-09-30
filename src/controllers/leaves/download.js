const { pool } = require('../../db/connector');
const PDFDocument = require('pdfkit');
const { DateTime } = require('luxon');

/**
 * @description Generates and streams a PDF leave application for a specific leave record.
 */
const downloadLeaveApplication = async (req, res) => {
    const { id } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                lr.id, lt.name as leave_type_name, lr.leave_description, lr.applied_date,
                lr.from_date, lr.to_date, lr.rejection_reason, lr.primary_status,
                lr.secondry_status,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                CONCAT(ns_user.prefix, LPAD(e.id, ns_user.padding_length, '0')) as full_employee_id,
                CONCAT(ns_leave.prefix, LPAD(lr.id, ns_leave.padding_length, '0')) as full_leave_id,
                j.title as job_title,
                CONCAT(pa.first_name, ' ', pa.last_name) as primary_approver_name,
                CONCAT(sa.first_name, ' ', sa.last_name) as secondary_approver_name
            FROM employee_leave_records lr
            LEFT JOIN leave_types lt ON lr.leave_type = lt.id
            LEFT JOIN user e ON lr.employee_id = e.id
            LEFT JOIN jobs j ON e.job_role = j.id
            LEFT JOIN name_series ns_user ON ns_user.table_name = 'user'
            LEFT JOIN name_series ns_leave ON ns_leave.table_name = 'employee_leave_records'
            LEFT JOIN user pa ON lr.primary_user = pa.id
            LEFT JOIN user sa ON lr.secondry_user = sa.id
            WHERE lr.id = ?;
        `;
        const [[record]] = await connection.query(sql, [id]);

        if (!record) {
            return res.status(404).json({ message: 'Leave record not found.' });
        }

        // --- PDF Generation ---
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="leave_application_${record.id}.pdf"`);

        doc.pipe(res);

        // --- Document Header ---
        doc.fontSize(20).font('Helvetica-Bold').text('Leave Application Form', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Application ID: ${record.full_leave_id || record.id}`, { align: 'center' });
        doc.moveDown(2);

        // --- Employee Details ---
        doc.fontSize(12).font('Helvetica-Bold').text('Employee Details');
        doc.font('Helvetica').text(`Employee Name: ${record.employee_name || 'N/A'}`);
        doc.text(`Employee ID: ${record.full_employee_id || e.id}`);
        doc.text(`Job Title: ${record.job_title || 'N/A'}`);
        doc.moveDown();

        // --- Leave Details ---
        doc.font('Helvetica-Bold').text('Leave Details');
        doc.font('Helvetica').text(`Application Date: ${DateTime.fromJSDate(record.applied_date).toFormat('dd LLLL yyyy')}`);
        doc.text(`Leave Type: ${record.leave_type_name || 'N/A'}`);
        doc.text(`Start Date: ${DateTime.fromJSDate(record.from_date).toFormat('dd LLLL yyyy')}`);
        doc.text(`End Date: ${DateTime.fromJSDate(record.to_date).toFormat('dd LLLL yyyy')}`);
        const duration = DateTime.fromJSDate(record.to_date).diff(DateTime.fromJSDate(record.from_date), 'days').days + 1;
        doc.text(`Duration: ${duration} day(s)`);
        doc.moveDown();
        doc.font('Helvetica-Bold').text('Reason for Leave:');
        doc.font('Helvetica').text(record.leave_description || 'No reason provided.');
        doc.moveDown();

        // --- Approval Status ---
        doc.font('Helvetica-Bold').text('Approval Status');
        const primaryStatus = record.primary_status === null ? 'Pending' : (record.primary_status ? 'Approved' : 'Rejected');
        const secondaryStatus = record.secondry_status === null ? 'Pending' : (record.secondry_status ? 'Approved' : 'Rejected');
        doc.font('Helvetica').text(`Manager Approval: ${primaryStatus} by ${record.primary_approver_name || 'N/A'}`);
        doc.text(`HR Approval: ${secondaryStatus} by ${record.secondary_approver_name || 'N/A'}`);
        if(record.rejection_reason){
             doc.text(`Rejection Reason: ${record.rejection_reason}`);
        }
        doc.moveDown(3);

        // --- Terms and Conditions ---
        doc.fontSize(10).font('Helvetica-Oblique').text('Terms & Conditions:', { underline: true });
        doc.fontSize(8).text('1. This leave is granted based on the company\'s leave policy and is subject to change.', { continued: true });
        doc.text(' All company property must be secured before proceeding on leave.');
        doc.text('2. The employee must be reachable on the provided contact number during the leave period for emergencies.');
        doc.text('3. Any extension of the leave period must be pre-approved by the reporting manager.');
        doc.moveDown(4);


        // --- Signature Section ---
        doc.fontSize(10).font('Helvetica');
        doc.text('_________________________', { continued: true });
        doc.text('                                                              _________________________');
        doc.text('      Employee Signature', { continued: true });
        doc.text('                                                                    Manager Signature');


        // Finalize the PDF and end the stream
        doc.end();

    } catch (error) {
        console.error(`Error generating PDF for leave record ${id}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    downloadLeaveApplication
};