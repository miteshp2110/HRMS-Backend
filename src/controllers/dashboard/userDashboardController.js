const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Gathers all necessary data for the authenticated user's personal dashboard.
 */
const getUserDashboardData = async (req, res) => {
    const employeeId = req.user.id;
    const today = DateTime.now();
    const startOfMonth = today.startOf('month').toISODate();
    const endOfMonth = today.endOf('month').toISODate();
    const oneMonthFromNow = today.plus({ months: 1 }).toISODate();

    let connection;
    try {
        connection = await pool.getConnection();

        // --- Prepare all database queries ---

        // 1. Get User Details (including full ID and manager's name)
        const userSql = `
            SELECT 
                u.first_name,
                u.last_name,
                CONCAT(ns.prefix, LPAD(u.id, ns.padding_length, '0')) as full_employee_id,
                CONCAT(manager.first_name, ' ', manager.last_name) as reports_to_name
            FROM user u
            LEFT JOIN name_series ns ON ns.table_name = 'user'
            LEFT JOIN user manager ON u.reports_to = manager.id
            WHERE u.id = ?;
        `;
        const userPromise = connection.query(userSql, [employeeId]);
        
        // 2. Get all required and uploaded documents for the user
        const requiredDocsSql = 'SELECT id, name FROM required_documents';
        const uploadedDocsSql = `SELECT document_id, expiry_date FROM uploaded_document WHERE user_id = ?`;
        const requiredDocsPromise = connection.query(requiredDocsSql);
        const uploadedDocsPromise = connection.query(uploadedDocsSql, [employeeId]);


        // 3. Get the next upcoming holiday
        const holidaysSql = 'SELECT name, holiday_date FROM holidays WHERE holiday_date >= ? ORDER BY holiday_date ASC LIMIT 1';
        const holidaysPromise = connection.query(holidaysSql, [today.toISODate()]);

        // 4. Get monthly attendance summary
        const attendanceSql = `
            SELECT 
                COUNT(ar.id) as total_days,
                SUM(CASE WHEN ar.attendance_status = 'Present' THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN ar.attendance_status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
                SUM(CASE WHEN ar.attendance_status = 'Leave' THEN 1 ELSE 0 END) as leave_days,
                SUM(LEAST(ar.hours_worked, s.scheduled_hours)) as total_hours_worked
            FROM attendance_record ar
            JOIN shifts s ON ar.shift = s.id
            WHERE ar.employee_id = ? AND ar.attendance_date BETWEEN ? AND ?;
        `;
        const attendancePromise = connection.query(attendanceSql, [employeeId, startOfMonth, endOfMonth]);

        const overtimeSql = `
            SELECT 
                SUM(CASE WHEN status = 'approved' THEN approved_hours ELSE 0 END) as approved_overtime,
                SUM(CASE WHEN status = 'rejected' THEN overtime_hours ELSE 0 END) as rejected_overtime
            FROM employee_overtime_records
            WHERE employee_id = ? AND request_date BETWEEN ? AND ?;
        `;
        const overtimePromise = connection.query(overtimeSql, [employeeId, startOfMonth, endOfMonth]);

        // 5. Get upcoming approved leave
        const upcomingLeaveSql = 'SELECT from_date, to_date, leave_description FROM employee_leave_records WHERE employee_id = ? AND secondry_status = TRUE AND from_date >= ? ORDER BY from_date ASC LIMIT 1';
        const upcomingLeavePromise = connection.query(upcomingLeaveSql, [employeeId, today.toISODate()]);

        // 6. Get pending leave requests for the user to approve
        const pendingLeaveSql = 'SELECT lr.id, lt.name as leave_type_name, lr.from_date as fromDate, lr.to_date as toDate FROM employee_leave_records lr JOIN user u ON lr.employee_id = u.id JOIN leave_types lt ON lr.leave_type = lt.id WHERE lr.primary_user = ? AND lr.primary_status IS NULL';
        const pendingLeavePromise = connection.query(pendingLeaveSql, [employeeId]);

        // 7. Get pending loan requests submitted by the user
        const pendingLoanSql = `SELECT la.id, la.requested_amount, lt.name FROM loan_applications la JOIN loan_types lt ON lt.id = la.loan_type_id WHERE employee_id = ? AND status = 'Pending Approval'`;
        const pendingLoanPromise = connection.query(pendingLoanSql, [employeeId]);

        // 8. Get pending expense requests submitted by the user
        const pendingExpenseSql = `SELECT id, title, amount FROM expense_claims WHERE employee_id = ? AND status = 'Pending'`;
        const pendingExpensePromise = connection.query(pendingExpenseSql, [employeeId]);
        
        // 9. Get pending overtime requests
        const pendingOvertimeSql = `SELECT id, overtime_hours, request_date FROM employee_overtime_records WHERE employee_id = ? AND status = 'pending_approval'`;
        const pendingOvertimePromise = connection.query(pendingOvertimeSql, [employeeId]);

        // 10. Get ongoing loans with paid/pending EMI details
        const ongoingLoansSql = `
            SELECT 
                la.id, la.application_id_text, la.approved_amount, la.emi_amount, la.tenure_months, lt.name as loan_type_name,
                (SELECT COUNT(*) FROM loan_amortization_schedule WHERE loan_application_id = la.id AND status = 'Paid') as emis_paid,
                (SELECT COUNT(*) FROM loan_amortization_schedule WHERE loan_application_id = la.id) as total_emis
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            WHERE la.employee_id = ? AND la.status = 'Disbursed';
        `;
        const ongoingLoansPromise = connection.query(ongoingLoansSql, [employeeId]);

        // 11. Get pending HR cases against the user
        const pendingCasesSql = `SELECT id, case_id_text, title FROM hr_cases WHERE employee_id = ? AND status = 'Open'`;
        const pendingCasesPromise = connection.query(pendingCasesSql, [employeeId]);

        // --- Execute all queries in parallel ---
        const [
            [[userDetails]],
            [requiredDocs],
            [uploadedDocs],
            [[upcomingHoliday]],
            [[attendanceSummary]],
            [[overtimeSummary]],
            [[upcomingLeave]],
            [pendingLeaveRequests],
            [pendingLoanRequests],
            [pendingExpenseRequests],
            [pendingOvertimeRequests],
            [ongoingLoans],
            [pendingCases]
        ] = await Promise.all([
            userPromise,
            requiredDocsPromise,
            uploadedDocsPromise,
            holidaysPromise,
            attendancePromise,
            overtimePromise,
            upcomingLeavePromise,
            pendingLeavePromise,
            pendingLoanPromise,
            pendingExpensePromise,
            pendingOvertimePromise,
            ongoingLoansPromise,
            pendingCasesPromise
        ]);

        // --- Process Document Data ---
        const uploadedDocMap = new Map(uploadedDocs.map(doc => [doc.document_id, doc.expiry_date]));
        const expiringDocuments = [];
        const notUploadedDocuments = [];

        requiredDocs.forEach(reqDoc => {
            if (uploadedDocMap.has(reqDoc.id)) {
                const expiryDate = uploadedDocMap.get(reqDoc.id);
                if (expiryDate && DateTime.fromJSDate(expiryDate) <= DateTime.fromISO(oneMonthFromNow)) {
                    expiringDocuments.push({ name: reqDoc.name, expiry_date: expiryDate });
                }
            } else {
                notUploadedDocuments.push({ name: reqDoc.name });
            }
        });

        // --- Assemble the final dashboard object ---
        const dashboardData = {
            user: userDetails,
            documentStatus: {
                expiring: expiringDocuments,
                notUploaded: notUploadedDocuments
            },
            upcomingHoliday: upcomingHoliday || null,
            monthlyAttendance: {
                ...attendanceSummary,
                ...overtimeSummary
            },
            upcomingLeave: upcomingLeave || null,
            pendingApprovals: {
                leaves: pendingLeaveRequests,
            },
            myPendingRequests: {
                loans: pendingLoanRequests,
                expenses: pendingExpenseRequests,
                overtime: pendingOvertimeRequests
            },
            ongoingLoans,
            pendingCases
        };
        
        res.status(200).json(dashboardData);

    } catch (error) {
        console.error('Error fetching user dashboard data:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { getUserDashboardData };