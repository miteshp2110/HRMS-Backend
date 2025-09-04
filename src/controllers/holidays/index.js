const { createHoliday } = require('./create');
const { getAllHolidays } = require('./read');
const { deleteHoliday } = require('./delete');
const { getWorkWeek, updateWorkWeek } = require('./workWeek');

module.exports = {
  createHoliday,
  getAllHolidays,
  deleteHoliday,
  getWorkWeek,
  updateWorkWeek,
};