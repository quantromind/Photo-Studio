const express = require('express');
const router = express.Router();
const { 
    getParties, createParty, setPartyPrices, deleteParty
} = require('../controllers/partyController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Base path: /api/parties
router.get('/', auth, roleGuard('studioadmin', 'staff'), getParties);
router.post('/create', auth, roleGuard('studioadmin'), createParty);
router.put('/prices/:id', auth, roleGuard('studioadmin'), setPartyPrices);
router.delete('/:id', auth, roleGuard('studioadmin'), deleteParty);

module.exports = router;
