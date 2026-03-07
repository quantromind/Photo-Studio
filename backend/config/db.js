const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'photostudio';
    const conn = await mongoose.connect(uri, { dbName });
    console.log(`✅ MongoDB Connected: ${conn.connection.host} | DB: ${dbName}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
