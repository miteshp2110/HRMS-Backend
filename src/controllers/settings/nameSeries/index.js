const { createNameSeries } = require('./create');
const { getAllNameSeries } = require('./read');
const { updateNameSeries } = require('./update');
const { deleteNameSeries } = require('./delete');

module.exports = {
  createNameSeries,
  getAllNameSeries,
  updateNameSeries,
  deleteNameSeries,
};