const { assignOrUpdateComponent } = require('./assign');
const { getEmployeeSalaryStructure, getMySalaryStructure } = require('./read');
const { removeComponent } = require('./delete');

module.exports = {
  assignOrUpdateComponent,
  getEmployeeSalaryStructure,
  removeComponent,
  getMySalaryStructure
};