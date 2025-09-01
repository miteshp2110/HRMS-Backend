const { createJob } = require('./create');
const { getAllJobs } = require('./read');
const { updateJob } = require('./update');
const { deleteJob } = require('./delete');

module.exports = {
  createJob,
  getAllJobs,
  updateJob,
  deleteJob,
};