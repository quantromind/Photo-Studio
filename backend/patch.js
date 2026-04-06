const fs = require('fs');
let code = fs.readFileSync('controllers/orderController.js', 'utf8');

const regex = /\/\/ Find or create customer \(atomic upsert to prevent duplicates\).*?\{ upsert: true, new: true, setDefaultsOnInsert: true \}\r?\n\s*\);/s;

const replacement = `            // Find or create customer based on Phone (primary identifying factor)
            let searchCondition = { phone: customerPhone, studio: studioId };
            let customer = await User.findOne(searchCondition);

            if (!customer) {
                // Determine if we can use the email, or if it clashes with another user
                let emailToUse = null;
                if (customerEmail) {
                    const existingEmail = await User.findOne({ email: customerEmail.toLowerCase() });
                    if (!existingEmail) emailToUse = customerEmail.toLowerCase();
                }
                
                customer = await User.create({
                    name: customerName,
                    phone: customerPhone,
                    email: emailToUse,
                    password: customerPhone || 'default123',
                    role: 'customer',
                    studio: studioId
                });
            } else {
                let isModified = false;
                // If the user changed the name manually in the UI, update the user record
                if (customer.name !== customerName) {
                    customer.name = customerName;
                    isModified = true;
                }
                
                // Set email if they provide one now and we don't already have one
                if (customerEmail && !customer.email) {
                    const existingEmail = await User.findOne({ email: customerEmail.toLowerCase() });
                    if (!existingEmail) {
                        customer.email = customerEmail.toLowerCase();
                        isModified = true;
                    }
                }
                if (isModified) await customer.save();
            }`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('controllers/orderController.js', code);
    console.log('PATCH SUCCESS');
} else {
    console.log('PATCH FAILED: REGEX NOT FOUND');
}
