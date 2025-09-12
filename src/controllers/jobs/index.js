const { createJob } = require('./create');
const { getAllJobs, getEmployeesByJob } = require('./read');
const { updateJob } = require('./update');
const { deleteJob } = require('./delete');

module.exports = {
  createJob,
  getAllJobs,
  updateJob,
  deleteJob,
  getEmployeesByJob
};