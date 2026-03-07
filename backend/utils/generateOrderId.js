const Order = require('../models/Order');

const generateOrderId = async () => {
    // Use a loop to handle race conditions — if duplicate, retry
    for (let attempt = 0; attempt < 5; attempt++) {
        const count = await Order.countDocuments();
        const num = (count + 1 + attempt).toString().padStart(4, '0');
        const orderId = `ORD-${num}`;

        // Check if this ID already exists
        const exists = await Order.findOne({ orderId });
        if (!exists) return orderId;
    }

    // Fallback: use timestamp-based ID
    const ts = Date.now().toString(36).toUpperCase();
    return `ORD-${ts}`;
};

module.exports = generateOrderId;
