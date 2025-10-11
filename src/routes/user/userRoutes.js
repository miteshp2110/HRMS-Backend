const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware');
const { createUser  } = require('../../controllers/user/create');
const { updateUser, getMyProfile, getUserProfileById, getAllUsers, searchUsers, findUsersByPermissions, getDirectReports, updateSelfProfile, deactivateUser, getUserAuditHistory, bulkUploadUsers, generateUserUploadTemplate } = require('../../controllers/user');
const { getMyDirectReports } = require('../../controllers/user/read');

const router = express.Router();
const canManageUser = authorize(['user.manage']);

// ... other user routes like /profile-image

// POST /api/users
// Creates a new user. Requires 'users.create' permission.

router.get('/direct-reports', authenticate, getMyDirectReports);
router.get('/template', authenticate, canManageUser, generateUserUploadTemplate);
router.post('/bulk-upload', authenticate, canManageUser, upload.single('file'), bulkUploadUsers);

router.post(
  '/',
  authenticate,
  canManageUser,
  upload.single('profileImage'), // Field name for the optional profile image
  createUser
);


router.patch(
  '/profile/:id',
  authenticate,
  canManageUser,
  updateUser
);

router.get("/profile",authenticate,getMyProfile)
router.patch("/self",authenticate,upload.single('profileImage'),updateSelfProfile)

router.get('/profile/:id',authenticate,canManageUser,getUserProfileById)
router.get('/profiles/all',authenticate,canManageUser,getAllUsers)
router.get('/search',authenticate,canManageUser,searchUsers)
router.get('/permissions',authenticate,canManageUser,findUsersByPermissions)
router.get('/reports/:managerId',authenticate,getDirectReports)
router.patch('/deactivate/:id', authenticate, canManageUser, deactivateUser);
router.get('/audit/:userId',authenticate,canManageUser,getUserAuditHistory)

module.exports = router;