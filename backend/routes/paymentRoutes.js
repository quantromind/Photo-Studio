const express = require('express');
const router = express.Router();
const {
    getLedger, recordPayment, getPartyPayments, deletePayment
} = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Base path: /api/payments
router.get('/ledger', auth, roleGuard('studioadmin', 'staff'), getLedger);
router.post('/', auth, roleGuard('studioadmin'), recordPayment);
router.get('/party/:partyId', auth, roleGuard('studioadmin', 'staff'), getPartyPayments);
router.delete('/:id', auth, roleGuard('studioadmin'), deletePayment);

module.exports = router;
