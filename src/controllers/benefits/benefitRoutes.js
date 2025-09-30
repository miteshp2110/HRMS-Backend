const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

const {
    createBenefitBand,
    getAllBenefitBands,
    updateBenefitBand
} = require('../../controllers/benefits/bands');

const {
    getMyBenefitBand
} = require('../../controllers/benefits/assignment');

const router = express.Router();

// Apply authentication to all routes in this file
router.use(authenticate);
const canManageBenefits = authorize(['benefits.manage']); // A new permission for managing benefits

// --- Admin Routes for Configuring Benefit Bands ---
router.post('/bands', canManageBenefits, createBenefitBand);
router.get('/bands', canManageBenefits, getAllBenefitBands);
router.patch('/bands/:id', canManageBenefits, updateBenefitBand);


// --- Employee Route for Viewing Their Assigned Band ---
router.get('/my-band', getMyBenefitBand);


module.exports = router;