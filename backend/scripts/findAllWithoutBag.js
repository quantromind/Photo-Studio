const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const findAllWithoutBag = async () => {
    try {
        const uri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;
        await mongoose.connect(uri, { dbName });
        
        const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
        const cats = await Category.find({ 
            $or: [
                { description: /WITHOUT BAG/i },
                { Description: /WITHOUT BAG/i },
                { name: /WITHOUT BAG/i }
            ]
        }).lean();
        
        console.log('Categories found:', JSON.stringify(cats, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findAllWithoutBag();
