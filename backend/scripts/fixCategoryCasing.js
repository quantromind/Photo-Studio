const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fixCategoryCasing = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
        const dbName = process.env.DB_NAME || 'Photo_Studio';
        
        console.log(`🔌 Connecting to MongoDB: ${uri} | DB: ${dbName}`);
        await mongoose.connect(uri, { dbName });
        console.log('✅ Connected to MongoDB');

        const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');

        // Find categories with Description (uppercase)
        const categories = await Category.find({ Description: { $exists: true } });
        console.log(`🔍 Found ${categories.length} categories with uppercase 'Description'`);

        for (const cat of categories) {
            console.log(`🛠️ Fixing category: ${cat.name}`);
            
            // Set description (lowercase) to the value of Description (uppercase)
            // Use updateOne to avoid schema validation issues and to unset the old field
            await Category.updateOne(
                { _id: cat._id },
                { 
                    $set: { description: cat.Description },
                    $unset: { Description: "" }
                }
            );
        }

        console.log('✨ All categories fixed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing categories:', error);
        process.exit(1);
    }
};

fixCategoryCasing();
