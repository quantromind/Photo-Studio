const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('./models/Order');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const order = await Order.findOne({ status: { $nin: ['completed', 'delivered'] } });
    if(order) {
        order.estimatedCompletion = new Date(Date.now() + 500000);
        await order.save();
        console.log('Modified order:', order.orderId);
    } else {
        console.log('No active orders found to modify');
    }
    process.exit(0);
}
run();
