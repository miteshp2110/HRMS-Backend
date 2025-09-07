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
const canManageCalendar = authorize(['calender.manage']);

router.use(authenticate);
// Public routes - any authenticated user can see the calendar
router.get('/', getAllHolidays);
router.get('/work-week', getWorkWeek);

// Admin routes - requires a specific permission to manage the calendar
router.post('/',canManageCalendar, createHoliday);
router.delete('/:id', canManageCalendar,deleteHoliday);
router.patch('/work-week',  canManageCalendar,updateWorkWeek);

module.exports = router;