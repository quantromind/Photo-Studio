const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const checkCategories = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
        const dbName = process.env.DB_NAME || 'Photo_Studio';
        await mongoose.connect(uri, { dbName });
        
        const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
        const categories = await Category.find().limit(5).lean();
        
        console.log('Sample Categories:', JSON.stringify(categories, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkCategories();
