const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createJob,
  getAllJobs,
  updateJob,
  deleteJob,
} = require('../../controllers/jobs');

const router = express.Router();

// Apply authentication and authorization middleware
router.use(authenticate);

// We'll use 'users.edit' for CUD and 'users.view' for R
router.post('/', authorize(['job.create']), createJob);
router.get('/', authorize(['user.view']), getAllJobs);
router.patch('/:id', authorize(['job.update']), updateJob);
router.delete('/:id', authorize(['job.delete']), deleteJob);

module.exports = router;