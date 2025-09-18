const { createShift } = require('./create');
const { getAllShifts } = require('./read');
const { updateShift } = require('./update');
const { deleteShift } = require('./delete');
const { rotateIndividualShifts } = require('./rotation');

module.exports = {
  createShift,
  getAllShifts,
  updateShift,
  deleteShift,
  rotateIndividualShifts
};