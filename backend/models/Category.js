const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true
    },
    categoryGroup: {
        type: String,
        trim: true,
        default: 'General'
    },
    studio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Studio',
        required: true
    },
    slaHours: {
        type: Number,
        required: [true, 'SLA hours is required'],
        min: 1
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    basePrice: {
        type: Number,
        default: 0
    },
    partyPrice: {
        type: Number,
        default: 0
    },
    hsnCode: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

// Compound index for unique category name per studio
categorySchema.index({ name: 1, studio: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
