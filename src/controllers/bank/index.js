const { addOrUpdateBankDetails } = require('./addOrUpdate');
const { getBankDetails } = require('./get');
const { deleteBankDetails } = require('./delete');
const { addOrUpdateMyBankDetails, getMyBankDetails } = require('./self');

module.exports = {
  addOrUpdateBankDetails,
  getBankDetails,
  deleteBankDetails,
  addOrUpdateMyBankDetails,
  getMyBankDetails
};