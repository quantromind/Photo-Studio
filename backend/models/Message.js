const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    community: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Community',
        default: null
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    content: {
        type: String,
        required: [true, 'Message content is required'],
        trim: true,
        maxlength: 2000
    },
    type: {
        type: String,
        enum: ['text', 'image', 'system'],
        default: 'text'
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isDirectMessage: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for fast message retrieval
messageSchema.index({ community: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ isDirectMessage: 1 });

module.exports = mongoose.model('Message', messageSchema);
