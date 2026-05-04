const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const findCategory = async () => {
    try {
        const uri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;
        await mongoose.connect(uri, { dbName });
        
        const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
        const cat = await Category.findOne({ name: "8" }).lean();
        
        console.log('Category "8":', JSON.stringify(cat, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findCategory();
