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

// We'll use a specific 'bank_details.manage' permission
router.get('/details/:employeeId', authorize(['user.view']), getBankDetails);
router.post('/details/:employeeId', authorize(['user.create']), addOrUpdateBankDetails);
router.delete('/details/:employeeId', authorize(['user.delete']), deleteBankDetails);
router.get("/self",getMyBankDetails)
router.post('/self',addOrUpdateMyBankDetails)

module.exports = router;