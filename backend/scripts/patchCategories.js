const mongoose = require('mongoose');
const path = require('path');
const Category = require('../models/Category');
const User = require('../models/User');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const patchCategories = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI + process.env.DB_NAME);
        console.log('✅ Connected to MongoDB');

        // Find the main studio admin (Shubham K or the first studioadmin)
        const admin = await User.findOne({ role: 'studioadmin', name: /Shubham/i });
        
        if (!admin || !admin.studio) {
            console.error('❌ Could not find a Studio Admin with a valid studio ID.');
            process.exit(1);
        }

        const targetStudioId = admin.studio;
        console.log(`🎯 Targeting Studio ID: ${targetStudioId} (Admin: ${admin.name})`);

        // Update all categories that have the wrong/old studio ID
        const result = await Category.updateMany(
            {}, // Update ALL for now to ensure they match your current studio
            { $set: { studio: targetStudioId } }
        );

        console.log(`✨ Successfully updated ${result.modifiedCount} categories to the correct Studio ID.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error patching categories:', error);
        process.exit(1);
    }
};

patchCategories();
