const Notification = require('../models/Notification');

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private (StudioAdmin, Staff)
exports.getNotifications = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        if (!studioId) return res.status(400).json({ message: 'Studio not found' });

        // Determine user roles for notification filtering
        const roles = [req.user.role]; // e.g., 'studioadmin' or 'staff'
        if (req.user.assignedSteps && req.user.assignedSteps.length > 0) {
            roles.push(...req.user.assignedSteps);
        }

        // Fetch notifications targeting the user's role or assigned steps
        const notifications = await Notification.find({
            studio: studioId,
            targetRoles: { $in: roles }
        })
        .sort('-createdAt')
        .limit(50); // Fetch latest 50 notifications

        // Mark read status on the fly based on readBy array
        const processedNotifications = notifications.map(notif => {
            const isRead = notif.readBy.includes(req.user._id);
            return {
                _id: notif._id,
                title: notif.title,
                message: notif.message,
                orderId: notif.orderId,
                order: notif.order,
                createdAt: notif.createdAt,
                isRead
            };
        });

        const unreadCount = processedNotifications.filter(n => !n.isRead).length;

        res.json({
            success: true,
            notifications: processedNotifications,
            unreadCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) return res.status(404).json({ message: 'Notification not found' });

        if (!notification.readBy.includes(req.user._id)) {
            notification.readBy.push(req.user._id);
            await notification.save();
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        const roles = [req.user.role, ...(req.user.assignedSteps || [])];

        const unreadNotifications = await Notification.find({
            studio: studioId,
            targetRoles: { $in: roles },
            readBy: { $ne: req.user._id }
        });

        // Add user ID to readBy array for all unread notifications
        if (unreadNotifications.length > 0) {
            await Notification.updateMany(
                { _id: { $in: unreadNotifications.map(n => n._id) } },
                { $addToSet: { readBy: req.user._id } }
            );
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
