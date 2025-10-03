const db = require('../../db/connector');

class CombinedReportsController {
    async generateCompleteEmployeeReport(req, res) {
        try {
            // Pull toggles from body
            const {
                employeeId, startDate, endDate, format = 'pdf',
                includeAttendance = true, includeLeave = true, includePerformance = true, includeCases = true
            } = req.body;
            // Fetch attendance
            let attendance = [];
            if (includeAttendance) {
                const [a] = await db.execute(
                    'SELECT * FROM attendance_record WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?',
                    [employeeId, startDate, endDate]
                );
                attendance = a;
            }
            // Fetch leaves
            let leaves = [];
            if (includeLeave) {
                const [l] = await db.execute(
                    'SELECT * FROM employee_leave_records WHERE employee_id = ? AND start_date >= ? AND end_date <= ?',
                    [employeeId, startDate, endDate]
                );
                leaves = l;
            }
            // Fetch performance
            let performance = [];
            if (includePerformance) {
                const [p] = await db.execute(
                    'SELECT * FROM performance_appraisals WHERE employee_id = ? AND created_on BETWEEN ? AND ?',
                    [employeeId, startDate, endDate]
                );
                performance = p;
            }
            // Cases
            let cases = [];
            if (includeCases) {
                const [c] = await db.execute(
                    'SELECT * FROM hr_cases WHERE employee_id = ? AND created_on BETWEEN ? AND ?',
                    [employeeId, startDate, endDate]
                );
                cases = c;
            }
            const summary = {
                attendanceRecords: attendance.length,
                leaves: leaves.length,
                performanceAppraisals: performance.length,
                hrCases: cases.length
            };
            res.json({success:true, downloadUrl:'', summary});
        } catch (e){
            res.status(500).json({success:false, message:e.message});
        }
    }
    async generateExecutiveDashboardReport(req, res){
        try {
            const {startDate, endDate, format = 'pdf'} = req.body;
            // Pull aggregate numbers (for illustration)
            const [[{attendanceRecords}]] = await db.execute('SELECT COUNT(*) as attendanceRecords FROM attendance_record WHERE attendance_date BETWEEN ? AND ?', [startDate, endDate]);
            const [[{totalLeaves}]] = await db.execute('SELECT COUNT(*) as totalLeaves FROM employee_leave_records WHERE start_date >= ? AND end_date <= ?', [startDate, endDate]);
            const [[{totalCases}]] = await db.execute('SELECT COUNT(*) as totalCases FROM hr_cases WHERE created_on BETWEEN ? AND ?', [startDate, endDate]);
            // Add more KPIs...
            const summary = {attendanceRecords, totalLeaves, totalCases};
            res.json({success:true, downloadUrl:'', summary});
        } catch(e) {
            res.status(500).json({success:false, message:e.message});
        }
    }
}
module.exports = new CombinedReportsController();
