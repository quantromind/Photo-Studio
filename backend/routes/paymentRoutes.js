const express = require('express');
const router = express.Router();
const {
    getLedger, recordPayment, getPartyPayments, deletePayment, getCustomerDue
} = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Base path: /api/payments
router.get('/ledger', auth, roleGuard('studioadmin', 'staff'), getLedger);
router.get('/customer-due/:phone', auth, roleGuard('studioadmin', 'staff'), getCustomerDue);
router.post('/', auth, roleGuard('studioadmin'), recordPayment);
router.get('/party/:partyId', auth, roleGuard('studioadmin', 'staff'), getPartyPayments);
router.delete('/:id', auth, roleGuard('studioadmin'), deletePayment);

module.exports = router;
