const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String
    },
    mimetype: {
        type: String
    },
    size: {
        type: Number
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    studio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Studio',
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

imageSchema.index({ order: 1 });
imageSchema.index({ studio: 1 });

module.exports = mongoose.model('Image', imageSchema);
