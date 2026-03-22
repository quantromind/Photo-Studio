const express = require('express');
const auth = require('../middleware/auth');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');

const router = express.Router();

router.route('/')
    .get(auth, getNotifications);

router.route('/:id/read')
    .put(auth, markAsRead);

router.route('/read-all')
    .put(auth, markAllAsRead);

module.exports = router;
