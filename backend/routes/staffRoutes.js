const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.use(auth);
router.use(roleGuard('studioadmin')); // Only studio admin can manage staff

router.route('/')
    .get(staffController.getStaff)
    .post(staffController.createStaff);

router.route('/:id')
    .put(staffController.updateStaff)
    .delete(staffController.deleteStaff);

module.exports = router;
