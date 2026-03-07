const express = require('express');
const router = express.Router();
const { trackOrder, getMyOrders, getCustomers, getOrderAlbum } = require('../controllers/customerController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Public routes
router.get('/track/:orderId', trackOrder);
router.get('/album/:orderId', getOrderAlbum);

// Authenticated routes
router.get('/orders', auth, roleGuard('customer'), getMyOrders);
router.get('/list', auth, roleGuard('studioadmin'), getCustomers);

module.exports = router;
