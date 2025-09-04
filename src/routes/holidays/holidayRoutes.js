const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  createHoliday,
  getAllHolidays,
  deleteHoliday,
  getWorkWeek,
  updateWorkWeek,
} = require('../../controllers/holidays');

const router = express.Router();

// Public routes - any authenticated user can see the calendar
router.get('/', authenticate, getAllHolidays);
router.get('/work-week', authenticate, getWorkWeek);

// Admin routes - requires a specific permission to manage the calendar
router.post('/', authenticate, createHoliday);
router.delete('/:id', authenticate,  deleteHoliday);
router.patch('/work-week', authenticate, updateWorkWeek);

module.exports = router;