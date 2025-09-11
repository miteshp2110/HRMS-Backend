const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Gathers all necessary data for the authenticated user's personal dashboard.
 */
const getMyDashboardData = async (req, res) => {
    const employeeId = req.user.id;
    const today = DateTime.now();
    const startOfMonth = today.startOf('month').toISODate();
    const endOfMonth = today.endOf('month').toISODate();
    const oneMonthFromNow = today.plus({ months: 1 }).toISODate();

    let connection;
    try {
        connection = await pool.getConnection();

        // --- Prepare all database queries ---

        // 1. MODIFIED: Get the complete attendance record for the current month
        const attendanceSql = `
            SELECT attendance_date, attendance_status, pay_type, punch_in, punch_out, hours_worked 
            FROM attendance_record 
            WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
            ORDER BY attendance_date ASC;
        `;
        const attendancePromise = connection.query(attendanceSql, [employeeId, startOfMonth, endOfMonth]);

        // 2. Get leave balances
        const leaveBalanceSql = `
            SELECT lt.name, elb.balance FROM employee_leave_balance elb
            JOIN leave_types lt ON elb.leave_id = lt.id
            WHERE elb.employee_id = ?;
        `;
        const leaveBalancePromise = connection.query(leaveBalanceSql, [employeeId]);
        
        // 3. Get expiring and missing documents
        const requiredDocsSql = 'SELECT id, name FROM required_documents';
        const uploadedDocsSql = `SELECT document_id, expiry_date FROM uploaded_document WHERE user_id = ?`;
        const requiredDocsPromise = connection.query(requiredDocsSql);
        const uploadedDocsPromise = connection.query(uploadedDocsSql, [employeeId]);
        
        // 4. MODIFIED: Get only the single next upcoming holiday
        const holidaysSql = 'SELECT name, holiday_date FROM holidays WHERE holiday_date >= ? ORDER BY holiday_date ASC LIMIT 1';
        const holidaysPromise = connection.query(holidaysSql, [today.toISODate()]);

        // 5. Get upcoming approved leaves
        const upcomingLeaveSql = 'SELECT from_date, to_date FROM employee_leave_records WHERE employee_id = ? AND secondry_status = TRUE AND from_date >= ? ORDER BY from_date ASC LIMIT 1';
        const upcomingLeavePromise = connection.query(upcomingLeaveSql, [employeeId, today.toISODate()]);

        // 6. Get ongoing loans
        const loansSql = "SELECT title, principal_amount, emi_amount, remaining_installments FROM employee_loans WHERE employee_id = ? AND status = 'active'";
        const loansPromise = connection.query(loansSql, [employeeId]);

        // 7. Get reporting manager's name
        const managerSql = `
            SELECT CONCAT(manager.first_name, ' ', manager.last_name) as manager_name 
            FROM user u LEFT JOIN user manager ON u.reports_to = manager.id
            WHERE u.id = ?
        `;
        const managerPromise = connection.query(managerSql, [employeeId]);

        // 8. NEW: Get pending overtime requests
        const pendingOvertimeSql = `
            SELECT attendance_date, hours_worked 
            FROM attendance_record 
            WHERE employee_id = ? AND pay_type = 'overtime' AND overtime_status = 0
            ORDER BY attendance_date DESC;
        `;
        const pendingOvertimePromise = connection.query(pendingOvertimeSql, [employeeId]);
        
        // --- Execute all queries in parallel ---
        const [
            [monthlyAttendance],
            [leaveBalances],
            [requiredDocs],
            [uploadedDocs],
            [[upcomingHoliday]], // Expect one or zero results
            [[upcomingLeave]],
            [ongoingLoans],
            [[manager]],
            [pendingOvertimeRequests] // New
        ] = await Promise.all([
            attendancePromise,
            leaveBalancePromise,
            requiredDocsPromise,
            uploadedDocsPromise,
            holidaysPromise,
            upcomingLeavePromise,
            loansPromise,
            managerPromise,
            pendingOvertimePromise // New
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
            monthlyAttendance,
            pendingOvertimeRequests,
            leaveBalances,
            documentStatus: {
                expiringSoon: expiringDocuments,
                notUploaded: notUploadedDocuments
            },
            upcomingHoliday: upcomingHoliday || null,
            upcomingLeave: upcomingLeave || null,
            ongoingLoans,
            reportingManager: manager ? manager.manager_name : null
        };
        
        res.status(200).json(dashboardData);

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description Gathers all necessary data for the Admin/HR dashboard.
 */
const getAdminDashboardData = async (req, res) => {
    const adminId = req.user.id;
    const permissions = req.user.permissions;
    const today = DateTime.now().toISODate();
    const oneMonthFromNow = DateTime.now().plus({ months: 1 }).toISODate();

    let connection;
    try {
        connection = await pool.getConnection();

        // --- Prepare all database queries to run in parallel ---

        // 1. Get total active employee count
        const headcountSql = 'SELECT COUNT(*) as total_employees FROM user WHERE is_active = TRUE';
        const headcountPromise = connection.query(headcountSql);

        // 2. Get today's attendance stats (present, absent, leave, late)
        const attendanceSql = `
            SELECT attendance_status, COUNT(*) as count 
            FROM attendance_record 
            WHERE attendance_date = ?
            GROUP BY attendance_status;
        `;
        const attendancePromise = connection.query(attendanceSql, [today]);

        // 3. Get documents expiring within the next month
        const expiringDocsSql = `
            SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS employee_name, rd.name as document_name, ud.expiry_date
            FROM uploaded_document ud
            JOIN user u ON ud.user_id = u.id
            JOIN required_documents rd ON ud.document_id = rd.id
            WHERE ud.expiry_date BETWEEN ? AND ?
            ORDER BY ud.expiry_date ASC;
        `;
        const expiringDocsPromise = connection.query(expiringDocsSql, [today, oneMonthFromNow]);
        
        // 4. Get pending leave requests for THIS admin/manager
        const primaryLeavesSql = 'SELECT COUNT(*) as count FROM employee_leave_records WHERE primary_user = ? AND primary_status = FALSE AND rejection_reason IS NULL';
        const primaryLeavesPromise = connection.query(primaryLeavesSql, [adminId]);
        
        let secondaryLeavesPromise = Promise.resolve([[{ count: 0 }]]); // Default to 0
        if (permissions.includes('secondary_leave_approvals')) {
            const secondaryLeavesSql = 'SELECT COUNT(*) as count FROM employee_leave_records WHERE primary_status = TRUE AND secondry_status = FALSE AND rejection_reason IS NULL';
            secondaryLeavesPromise = connection.query(secondaryLeavesSql);
        }

        // 5. Get pending skill requests
        const pendingSkillsSql = `
            SELECT esm.id, CONCAT(u.first_name, ' ', u.last_name) as employee_name, s.skill_name, esm.created_at
            FROM employee_skill_matrix esm
            JOIN user u ON esm.employee_id = u.id
            JOIN skills s ON esm.skill_id = s.id
            WHERE esm.status IS NULL
            ORDER BY esm.created_at ASC LIMIT 5;
        `;
        const pendingSkillsPromise = connection.query(pendingSkillsSql);

        // 6. Get pending loan requests
        const pendingLoansSql = `
            SELECT l.id, CONCAT(u.first_name, ' ', u.last_name) as employee_name, l.loan_type, l.principal_amount, l.request_date
            FROM employee_loans l
            JOIN user u ON l.employee_id = u.id
            WHERE l.status = 'pending_approval'
            ORDER BY l.request_date ASC LIMIT 5;
        `;
        const pendingLoansPromise = connection.query(pendingLoansSql);

        // --- Execute all queries in parallel ---
        const [
            [[headcount]],
            [attendanceStats],
            [expiringDocuments],
            [[primaryLeaves]],
            [[secondaryLeaves]],
            [pendingSkillRequests],
            [pendingLoanRequests]
        ] = await Promise.all([
            headcountPromise,
            attendancePromise,
            expiringDocsPromise,
            primaryLeavesPromise,
            secondaryLeavesPromise,
            pendingSkillsPromise,
            pendingLoansPromise
        ]);

        // --- Process and Assemble the final dashboard object ---
        const todayAttendance = { present: 0, absent: 0, leave: 0, late: 0 };
        attendanceStats.forEach(stat => {
            if (todayAttendance.hasOwnProperty(stat.attendance_status)) {
                todayAttendance[stat.attendance_status] = stat.count;
            }
        });

        const dashboardData = {
            headcount: headcount.total_employees,
            todayAttendance,
            expiringDocuments,
            pendingLeaveApprovals: {
                primary: primaryLeaves.count,
                secondary: secondaryLeaves.count
            },
            pendingSkillRequests,
            pendingLoanRequests
        };
        
        res.status(200).json(dashboardData);

    } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { getMyDashboardData ,getAdminDashboardData};