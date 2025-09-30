const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware');
const onboardingController = require('../../controllers/onboarding/onboardingController');

const router = express.Router();

router.use(authenticate);
const canManageOnboarding = authorize(['onboarding.manage']);

// --- Job Opening Routes ---
router.post('/openings', canManageOnboarding, onboardingController.createJobOpening);
router.get('/openings', canManageOnboarding, onboardingController.getAllJobOpenings);
router.patch('/openings/:openingId/status', canManageOnboarding, onboardingController.updateJobOpeningStatus);
router.get('/openings/:openingId/applicants', canManageOnboarding, onboardingController.getApplicantsForOpening);

// --- Applicant Routes ---
router.post('/openings/:openingId/applicants', canManageOnboarding, upload.single('resume'), onboardingController.addApplicant);
router.patch('/applicants/:applicantId/status', canManageOnboarding, onboardingController.updateApplicantStatus);
router.post('/applicants/:applicantId/convert', canManageOnboarding, onboardingController.convertApplicantToEmployee);

module.exports = router;