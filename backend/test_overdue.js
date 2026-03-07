const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI;

mongoose.connect(uri, { dbName: process.env.DB_NAME })
    .then(async () => {
        try {
            const Order = require('./models/Order');
            const overdueQuery = {
                status: { $nin: ['completed', 'delivered'] },
                estimatedCompletion: { $lt: new Date() }
            };
            const orders = await Order.find(overdueQuery);
            console.log(`Overdue orders count: ${orders.length}`);

            const allPendingOrders = await Order.find({ status: { $ne: 'completed' } });
            console.log(`All pending orders count: ${allPendingOrders.length}`);

            console.log("Details of pending:");
            allPendingOrders.forEach(o => {
                console.log(`ID: ${o.orderId}, Status: ${o.status}, EstComp: ${o.estimatedCompletion}, now: ${new Date()}`);
                console.log(`Is DB type Date?: ${o.estimatedCompletion instanceof Date}`);
                if (o.estimatedCompletion) {
                    console.log(`Is Overdue?: ${new Date(o.estimatedCompletion).getTime() < new Date().getTime()}`);
                }
            });

        } catch (err) {
            console.error(err);
        } finally {
            mongoose.connection.close();
        }
    })
    .catch(console.error);
