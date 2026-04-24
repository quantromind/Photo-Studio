const mongoose = require('mongoose');

const ORDER_STATUSES = [
    'reception',
    'designing',
    'printing',
    'binding',
    'quality_check',
    'delivered',
    'cancelled'
];

const statusHistorySchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ORDER_STATUSES,
        required: true
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    changedAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        default: ''
    }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        required: true
    },
    studio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Studio',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party'
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    }],
    categoryQuantities: {
        type: Map,
        of: Number,
        default: {}
    },
    status: {
        type: String,
        enum: ORDER_STATUSES,
        default: 'reception'
    },
    statusHistory: [statusHistorySchema],
    notes: {
        type: String,
        default: ''
    },
    coupleName: {
        type: String,
        default: ''
    },
    estimatedCompletion: {
        type: Date
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    advancePayment: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    taxType: {
        type: String,
        enum: ['exclusive', 'inclusive'],
        default: 'exclusive'
    },
    images: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image'
    }],
    billImages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image'
    }],
    isParty: {
        type: Boolean,
        default: false
    },
    cancellationReason: {
        type: String,
        default: ''
    },
    cancelledAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes for fast queries
orderSchema.index({ studio: 1, status: 1 });
orderSchema.index({ customer: 1 });

// Static method to get next status
orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;

orderSchema.methods.getNextStatus = function () {
    if (this.status === 'cancelled' || this.status === 'delivered') return null;
    const WORKFLOW_STATUSES = ORDER_STATUSES.filter(s => s !== 'cancelled');
    const currentIndex = WORKFLOW_STATUSES.indexOf(this.status);
    if (currentIndex < WORKFLOW_STATUSES.length - 1) {
        return WORKFLOW_STATUSES[currentIndex + 1];
    }
    return null;
};

module.exports = mongoose.model('Order', orderSchema);
