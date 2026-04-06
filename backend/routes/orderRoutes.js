const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrder, updateOrderStatus, getOrderStats, getRevenueStats, getRevenueExport, deleteOrder, updateBilling, cancelOrder } = require('../controllers/orderController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.get('/stats', auth, roleGuard('studioadmin', 'staff'), getOrderStats);
router.get('/revenue', auth, roleGuard('studioadmin', 'staff'), getRevenueStats);
router.get('/revenue-export', auth, roleGuard('studioadmin', 'staff'), getRevenueExport);
router.post('/', auth, roleGuard('studioadmin', 'staff'), createOrder);
router.get('/', auth, roleGuard('studioadmin', 'staff'), getOrders);
router.get('/:id', auth, roleGuard('studioadmin', 'customer', 'staff'), getOrder);
router.put('/:id/status', auth, roleGuard('studioadmin', 'staff'), updateOrderStatus);
router.put('/:id/billing', auth, roleGuard('studioadmin', 'staff'), updateBilling);
router.put('/:id/cancel', auth, roleGuard('studioadmin', 'staff'), cancelOrder);
router.delete('/:id', auth, roleGuard('studioadmin', 'staff'), deleteOrder);

module.exports = router;
