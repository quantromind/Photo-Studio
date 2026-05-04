const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const listNames = async () => {
    try {
        const uri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;
        await mongoose.connect(uri, { dbName });
        
        const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
        const categories = await Category.find({}, { name: 1, description: 1, Description: 1 }).lean();
        
        console.log('Category Names/Descriptions:', JSON.stringify(categories, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

listNames();
