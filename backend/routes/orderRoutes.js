const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrder, updateOrderStatus, getOrderStats, getRevenueStats, getRevenueExport, deleteOrder, updateBilling } = require('../controllers/orderController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.get('/stats', auth, roleGuard('studioadmin'), getOrderStats);
router.get('/revenue', auth, roleGuard('studioadmin'), getRevenueStats);
router.get('/revenue-export', auth, roleGuard('studioadmin'), getRevenueExport);
router.post('/', auth, roleGuard('studioadmin'), createOrder);
router.get('/', auth, roleGuard('studioadmin'), getOrders);
router.get('/:id', auth, roleGuard('studioadmin', 'customer'), getOrder);
router.put('/:id/status', auth, roleGuard('studioadmin'), updateOrderStatus);
router.put('/:id/billing', auth, roleGuard('studioadmin'), updateBilling);
router.delete('/:id', auth, roleGuard('studioadmin'), deleteOrder);

module.exports = router;
