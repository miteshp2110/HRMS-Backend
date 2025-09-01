const { createLeaveType } = require('./create');
const { getAllLeaveTypes } = require('./read');
const { updateLeaveType } = require('./update');
const { deleteLeaveType } = require('./delete');

module.exports = {
  createLeaveType,
  getAllLeaveTypes,
  updateLeaveType,
  deleteLeaveType,
};