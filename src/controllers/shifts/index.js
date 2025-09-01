const { createShift } = require('./create');
const { getAllShifts } = require('./read');
const { updateShift } = require('./update');
const { deleteShift } = require('./delete');

module.exports = {
  createShift,
  getAllShifts,
  updateShift,
  deleteShift,
};