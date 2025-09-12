const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createJob,
  getAllJobs,
  updateJob,
  deleteJob,
  getEmployeesByJob,
} = require('../../controllers/jobs');

const router = express.Router();

// Apply authentication and authorization middleware
router.use(authenticate);
const canManageJobs = authorize(['job.manage']);
router.use(canManageJobs);

// We'll use 'users.edit' for CUD and 'users.view' for R
router.post('/',  createJob);
router.get('/',  getAllJobs);
router.patch('/:id',  updateJob);
router.delete('/:id',  deleteJob);
router.get('/:jobId/employees',getEmployeesByJob)

module.exports = router;