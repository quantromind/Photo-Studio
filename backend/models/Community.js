const mongoose = require('mongoose');

const communitySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Group name is required'],
        trim: true,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ''
    },
    avatar: {
        type: String,
        default: '💬'
    },
    studio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Studio',
        default: null
    },
    type: {
        type: String,
        enum: ['group', 'announcement', 'general'],
        default: 'group'
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for fast lookups
communitySchema.index({ studio: 1 });
communitySchema.index({ members: 1 });

module.exports = mongoose.model('Community', communitySchema);
