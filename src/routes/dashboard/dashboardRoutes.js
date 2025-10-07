const express = require('express');
const authenticate = require('../../middleware/authenticate');
const { getMyDashboardData, getAdminDashboardData } = require('../../controllers/dashboard/main');
const { getUserDashboardData } = require('../../controllers/dashboard/userDashboardController');

const router = express.Router();
router.use(authenticate);

// --- Route for the employee's personal dashboard ---
// GET /api/dashboard/me
router.get('/me', getMyDashboardData);
router.get('/admin',getAdminDashboardData)
router.get('/user', getUserDashboardData);

module.exports = router;