const { assignOrUpdateComponent } = require('./assign');
const { getEmployeeSalaryStructure } = require('./read');
const { removeComponent } = require('./delete');

module.exports = {
  assignOrUpdateComponent,
  getEmployeeSalaryStructure,
  removeComponent,
};