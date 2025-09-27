const { assignOrUpdateComponent } = require('./assign');
const { getEmployeeSalaryStructure, getMySalaryStructure, getStandardParameters } = require('./read');
const { removeComponent } = require('./delete');
const { editEmployeeComponent } = require('./edit');

module.exports = {
  assignOrUpdateComponent,
  getEmployeeSalaryStructure,
  removeComponent,
  getMySalaryStructure,
  editEmployeeComponent,
  getStandardParameters
};