const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    studio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Studio',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    orderId: {
        type: String
    },
    // The roles or assigned steps that should see this notification
    // e.g., ['studioadmin', 'reception', 'designing']
    targetRoles: [{
        type: String
    }],
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

notificationSchema.index({ studio: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
