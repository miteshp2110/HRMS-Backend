const { approveOvertime } = require('./approve');
const { getAttendanceAuditHistory, getOvertimeAuditHistory } = require('./audit');
const { requestOvertime, getMyOvertimeRecords, getOvertimeRequestsForApproval, approveOrRejectOvertime, updateOvertimeRecord, deleteOvertimeRequest, getOvertimeRequestsForApprovalForId } = require('./overtime');
const { punchIn, punchOut } = require('./punch');
const { getMyAttendance, getAttendanceRecords } = require('./read');
const { getEmployeeMonthlySummary, getAttendanceRecordById } = require('./summary');
const { updatePayType } = require('./update');
// const { getMyAttendance, getAttendanceByEmployee } = require('./read');
// const { editAttendanceRecord } = require('./approval');

module.exports = {
  punchIn,
  punchOut,
  getMyAttendance,
  getAttendanceRecords,
  updatePayType,
  approveOvertime,
  requestOvertime,
  getMyOvertimeRecords,
  getOvertimeRequestsForApproval,
  approveOrRejectOvertime,
  updateOvertimeRecord,
  deleteOvertimeRequest,
  getEmployeeMonthlySummary,
  getAttendanceRecordById,
  getAttendanceAuditHistory,
  getOvertimeAuditHistory,
  getOvertimeRequestsForApprovalForId
};