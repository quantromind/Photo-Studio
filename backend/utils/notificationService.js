/**
 * Notification Service
 * Placeholder for SMS/WhatsApp/Email notifications.
 * Structured for easy integration with Twilio, SendGrid, etc.
 */

const sendNotification = async ({ type, to, message, orderId }) => {
    // Log notification (placeholder)
    console.log(`📧 [NOTIFICATION] Type: ${type} | To: ${to} | Order: ${orderId}`);
    console.log(`   Message: ${message}`);

    // TODO: Integrate with actual services:
    // - Twilio for SMS/WhatsApp
    // - SendGrid/Nodemailer for Email

    return { success: true, type, to, message };
};

const notifyOrderStatusChange = async (order, customer, newStatus) => {
    const statusLabels = {
        reception: 'Reception',
        designing: 'Designing',
        printing: 'Printing',
        binding: 'Binding',
        quality_check: 'Quality Check',
        delivered: 'Delivered',
        completed: 'Completed (Order History)'
    };

    const message = `Your order #${order.orderId} has moved to ${statusLabels[newStatus] || newStatus} stage.`;

    if (customer.email) {
        await sendNotification({
            type: 'email',
            to: customer.email,
            message,
            orderId: order.orderId
        });
    }

    if (customer.phone) {
        await sendNotification({
            type: 'sms',
            to: customer.phone,
            message,
            orderId: order.orderId
        });
    }
};

module.exports = { sendNotification, notifyOrderStatusChange };
