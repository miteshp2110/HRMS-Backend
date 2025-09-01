const { approveOvertime } = require('./approve');
const { punchIn, punchOut } = require('./punch');
const { getMyAttendance, getAttendanceRecords } = require('./read');
const { updatePayType } = require('./update');
// const { getMyAttendance, getAttendanceByEmployee } = require('./read');
// const { editAttendanceRecord } = require('./approval');

module.exports = {
  punchIn,
  punchOut,
  getMyAttendance,
  getAttendanceRecords,
  updatePayType,
  approveOvertime
};