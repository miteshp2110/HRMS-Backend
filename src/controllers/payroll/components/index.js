const { createComponent } = require('./create');
const { getAllComponents } = require('./read');
const { updateComponent } = require('./update');
const { deleteComponent } = require('./delete');

module.exports = {
  createComponent,
  getAllComponents,
  updateComponent,
  deleteComponent,
};