const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  addOrUpdateBankDetails,
  getBankDetails,
  deleteBankDetails,
  getMyBankDetails,
  addOrUpdateMyBankDetails,
} = require('../../controllers/bank');

const router = express.Router();

router.use(authenticate);

const canManageBankDetails = authorize(['user.manage']); 

router.get('/details/:employeeId', canManageBankDetails, getBankDetails);
router.post('/details/:employeeId', canManageBankDetails, addOrUpdateBankDetails);
router.delete('/details/:employeeId', canManageBankDetails, deleteBankDetails);
router.get("/self",getMyBankDetails)
router.post('/self',addOrUpdateMyBankDetails)

module.exports = router;