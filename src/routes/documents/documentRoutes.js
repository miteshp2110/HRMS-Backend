const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware')
const {
  createDocument,
  getAllDocuments,
  updateDocument,
  deleteDocument,
  getMyDocuments,
  uploadDocument,
  getDocumentsByEmployeeId,
  deleteUploadedDocument,
  getExpiringDocuments,
} = require('../../controllers/documents');

const router = express.Router();

router.use(authenticate);
const canManageDocuments = authorize(['documents.manage']);

// We'll use a specific 'documents.manage' permission for CUD actions
router.post('/', canManageDocuments, createDocument);
router.get('/', getAllDocuments); // Any user can see the list of required docs
router.patch('/:id', canManageDocuments, updateDocument);
router.delete('/:id', canManageDocuments, deleteDocument);

// Uploading

// --- Employee Self-Service Routes ---
router.get('/my-documents', getMyDocuments); // Employee gets their own docs
router.post(
  '/upload', // Employee uploads for themselves (employeeId must match their own)
  upload.single('documentFile'), 
  uploadDocument
);

// --- Admin Management Routes ---
router.get(
  '/employee/:employeeId', // Admin gets docs for a specific employee
  canManageDocuments, 
  getDocumentsByEmployeeId
);
router.post(
  '/employee/:employeeId',
  canManageDocuments,
  upload.single('documentFile'),
  uploadDocument
);

router.get('/expiring',canManageDocuments, getExpiringDocuments);
// --- Shared Delete Route (logic is handled in the controller) ---
router.delete('/uploaded/:documentId',deleteUploadedDocument);



module.exports = router;