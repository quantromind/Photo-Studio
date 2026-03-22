const mongoose = require('mongoose');

const ORDER_STATUSES = [
    'reception',
    'designing',
    'printing',
    'binding',
    'quality_check',
    'delivered'
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
        ref: 'User',
        required: true
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    }],
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
    images: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image'
    }]
}, {
    timestamps: true
});

// Indexes for fast queries
orderSchema.index({ studio: 1, status: 1 });
orderSchema.index({ customer: 1 });

// Static method to get next status
orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;

orderSchema.methods.getNextStatus = function () {
    const currentIndex = ORDER_STATUSES.indexOf(this.status);
    if (currentIndex < ORDER_STATUSES.length - 1) {
        return ORDER_STATUSES[currentIndex + 1];
    }
    return null;
};

module.exports = mongoose.model('Order', orderSchema);
