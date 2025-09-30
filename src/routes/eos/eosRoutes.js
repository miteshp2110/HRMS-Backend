const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
    initiateSettlement,
    getSettlementDetails,
    updateSettlementDeductions,
    approveSettlement,
    recordPayment,
    getAllSettlements
} = require('../../controllers/eos/eosController');

const router = express.Router();

router.use(authenticate);
const canManageEos = authorize(['eos.manage']); // You'll need to add this permission

router.post('/initiate', canManageEos, initiateSettlement);
router.get('/', canManageEos, getAllSettlements);
router.get('/:settlementId', canManageEos, getSettlementDetails);
router.patch('/:settlementId/deductions', canManageEos, updateSettlementDeductions);
router.patch('/:settlementId/approve', canManageEos, approveSettlement);
router.patch('/:settlementId/payment', canManageEos, recordPayment);

module.exports = router;