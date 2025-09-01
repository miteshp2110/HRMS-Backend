const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const upload = require('../../middleware/uploadMiddleware');
const { createUser /*, other controllers */ } = require('../../controllers/user/userController');
const { updateUser } = require('../../controllers/user');

const router = express.Router();

// ... other user routes like /profile-image

// POST /api/users
// Creates a new user. Requires 'users.create' permission.
router.post(
  '/',
  authenticate,
  authorize(['user.create']),
  upload.single('profileImage'), // Field name for the optional profile image
  createUser
);


router.patch(
  '/:id',
  authenticate,
  authorize(['user.update']),
  updateUser
);

module.exports = router;