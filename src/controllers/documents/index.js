const { createDocument } = require('./create');
const { getAllDocuments, getMyDocuments, getDocumentsByEmployeeId } = require('./read');
const { updateDocument } = require('./update');
const { deleteDocument, deleteUploadedDocument } = require('./delete');
const { uploadDocument } = require('./upload');

module.exports = {
  createDocument,
  getAllDocuments,
  updateDocument,
  deleteDocument,
  uploadDocument,
  getMyDocuments,
  getDocumentsByEmployeeId,
  deleteUploadedDocument
};