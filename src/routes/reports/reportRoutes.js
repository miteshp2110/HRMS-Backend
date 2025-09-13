const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { generatePayrollReport } = require('../../controllers/reports/payroll/report');

const router = express.Router();
router.use(authenticate);

router.get('/payroll/run/:payrollId',generatePayrollReport)

module.exports = router;