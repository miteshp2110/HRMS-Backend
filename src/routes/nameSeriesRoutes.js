const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const {
  createNameSeries,
  getAllNameSeries,
  updateNameSeries,
  deleteNameSeries,
} = require('../controllers/settings/nameSeries');
const { globalSearchByPrefixedId } = require('../controllers/settings/nameSeries/search');

const router = express.Router();
router.use(authenticate);

// Protect these administrative routes with a suitable permission
// const canManageSettings = authorize(['settings.manage']);

router.get("/search/:searchTerm",globalSearchByPrefixedId)
router.post('/', createNameSeries);
router.get('/',  getAllNameSeries);
router.patch('/:id',  updateNameSeries);
router.delete('/:id',  deleteNameSeries);

module.exports = router;