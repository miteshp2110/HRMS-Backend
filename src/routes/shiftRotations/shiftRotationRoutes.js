const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const rotationController = require('../../controllers/shifts/shiftRotationControlller');

const router = express.Router();
router.use(authenticate);
const canManageShifts = authorize([]);

// CRUD for Shift Rotations
router.post('/', canManageShifts, rotationController.createRotation);
router.get('/', canManageShifts, rotationController.getAllRotations);
router.get('/:rotationId', canManageShifts, rotationController.getRotationById);
router.put('/:rotationId', canManageShifts, rotationController.updateRotation);
router.delete('/:rotationId', canManageShifts, rotationController.deleteRotation);

// Approval Workflow
router.patch('/:rotationId/submit', canManageShifts, rotationController.submitForApproval);
router.patch('/:rotationId/approve', canManageShifts, rotationController.processApproval);

module.exports = router;
