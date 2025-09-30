const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const controller = require('../../controllers/performance/performanceController');

const router = express.Router();
router.use(authenticate);

const canManagePerformance = authorize(['performance.manage']);

// Admin routes for setup
router.post('/cycles', canManagePerformance, controller.createCycle);
router.get('/cycles', controller.getCycles);
router.post('/kpis', canManagePerformance, controller.createKpi);
router.get('/kpis', controller.getKpis);

// Manager routes
router.post('/appraisals/initiate-team', canManagePerformance, controller.createAppraisalsForTeam);
router.get('/appraisals/team/:cycleId', canManagePerformance, controller.getTeamAppraisalStatuses);
router.post('/goals', canManagePerformance, controller.assignGoal);
router.post('/kpis/assign', canManagePerformance, controller.assignKpi);
router.patch('/appraisals/:appraisalId/manager-assess', canManagePerformance, controller.submitManagerAssessment); // <-- NEW ROUTE

// Universal routes
router.get('/appraisals/my/:cycleId', controller.getMyAppraisal);
router.get('/appraisals/:appraisalId', controller.getAppraisalDetails);
router.patch('/appraisals/:appraisalId/self-assess', controller.submitSelfAssessment);

module.exports = router;