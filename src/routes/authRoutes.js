const express = require('express');
const { login, changePassword } = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Define the login route
router.post('/login', login);
router.post('/change-password',authenticate,authorize(['master.key']),changePassword);

module.exports = router;