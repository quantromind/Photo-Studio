const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party',
        required: [true, 'Party is required']
    },
    studio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Studio',
        required: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [1, 'Amount must be at least 1']
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'other'],
        default: 'cash'
    },
    reference: {
        type: String,
        trim: true,
        default: ''
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes for fast lookups
paymentSchema.index({ party: 1, studio: 1 });
paymentSchema.index({ studio: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
