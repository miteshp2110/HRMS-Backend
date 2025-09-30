const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware');
const categoriesController = require('../../controllers/cases/categoriesController');
const casesController = require('../../controllers/cases/casesController');

const router = express.Router();

router.use(authenticate);
const canManageCases = authorize(['cases.manage']);

// Category Management (HR)
router.post('/categories', canManageCases, categoriesController.createCategory);
router.get('/categories', canManageCases, categoriesController.getAllCategories);

// Case Management (HR)
router.get('/approvals', casesController.getApprovalQueue);
router.patch('/approvals/:caseId', casesController.processCaseApproval);
router.post('/', canManageCases, upload.single('evidence'), casesController.createCase);
router.get('/', canManageCases, casesController.getAllCases);
router.get('/:caseId', canManageCases, casesController.getCaseById);
router.post('/:caseId/sync-payroll', canManageCases, casesController.syncDeductionToPayroll);

// Case Approval (Manager)

module.exports = router;