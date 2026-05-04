const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('../models/User'); // Register schema

const checkStaff = async () => {
    try {
        const uri = process.env.MONGO_URI;
        const dbName = process.env.DB_NAME;
        await mongoose.connect(uri, { dbName });
        
        const User = mongoose.model('User');
        const staff = await User.find({ role: 'staff' }).limit(5).lean();
        
        console.log('Sample Staff:', JSON.stringify(staff, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkStaff();
