const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware');
const { createUser /*, other controllers */ } = require('../../controllers/user/userController');
const { updateUser, getMyProfile, getUserProfileById } = require('../../controllers/user');

const router = express.Router();
const canManageUser = authorize(['user.manage']);

// ... other user routes like /profile-image

// POST /api/users
// Creates a new user. Requires 'users.create' permission.
router.post(
  '/',
  authenticate,
  canManageUser,
  upload.single('profileImage'), // Field name for the optional profile image
  createUser
);


router.patch(
  '/:id',
  authenticate,
  canManageUser,
  updateUser
);

router.get("/profile",authenticate,getMyProfile)

router.get('/profile/:id',authenticate,canManageUser,getUserProfileById)

module.exports = router;