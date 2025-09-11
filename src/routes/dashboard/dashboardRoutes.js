const express = require('express');
const authenticate = require('../../middleware/authenticate');
const { getMyDashboardData, getAdminDashboardData } = require('../../controllers/dashboard/main');

const router = express.Router();
router.use(authenticate);

// --- Route for the employee's personal dashboard ---
// GET /api/dashboard/me
router.get('/me', getMyDashboardData);
router.get('/admin',getAdminDashboardData)

module.exports = router;