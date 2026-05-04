const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const findWithoutBag = async () => {
    try {
        const uri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;
        await mongoose.connect(uri, { dbName });
        
        const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
        const cat = await Category.findOne({ description: /WITHOUT BAG/i }).lean();
        
        console.log('Category with WITHOUT BAG:', JSON.stringify(cat, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findWithoutBag();
