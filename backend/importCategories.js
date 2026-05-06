const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('./models/Category');

dotenv.config();

const importCSV = async () => {
    try {
        // Connect to MongoDB
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        const results = [];
        const csvFilePath = path.join(__dirname, 'categories.csv');

        if (!fs.existsSync(csvFilePath)) {
            console.error('Error: categories.csv file not found in the backend folder.');
            process.exit(1);
        }

        fs.createReadStream(csvFilePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                console.log(`Read ${results.length} rows from CSV. Starting import...`);

                let successCount = 0;
                let errorCount = 0;

                for (const row of results) {
                    try {
                        // Handle studio ID (might be raw string or MongoDB $oid object format)
                        let studioId = row.studio;
                        if (studioId && studioId.includes('$oid')) {
                            try {
                                const parsed = JSON.parse(studioId.replace(/'/g, '"'));
                                studioId = parsed.$oid;
                            } catch (e) {
                                // If it fails to parse, try to extract it with regex
                                const match = studioId.match(/[0-9a-f]{24}/i);
                                if (match) studioId = match[0];
                            }
                        }

                        const categoryData = {
                            name: row.name || row.Name,
                            categoryGroup: row.Category || 'General',
                            description: row.Description || row.description || '',
                            basePrice: Number(row.price) || Number(row.Price) || 0,
                            partyPrice: Number(row.partyPrice) || 0,
                            slaHours: Number(row.slaHours) || Number(row.SLA) || 24,
                            isActive: row.isActive === 'TRUE' || row.isActive === 'true' || true,
                            studio: studioId
                        };

                        if (!categoryData.name || !categoryData.studio) {
                            console.warn(`Skipping row: Missing name or studio.`, row);
                            errorCount++;
                            continue;
                        }

                        // Check if category already exists for this studio (unique index on name + studio)
                        const existing = await Category.findOne({ 
                            name: categoryData.name, 
                            studio: categoryData.studio 
                        });

                        if (existing) {
                            // Update existing
                            await Category.findByIdAndUpdate(existing._id, categoryData);
                        } else {
                            // Create new
                            await Category.create(categoryData);
                        }

                        successCount++;
                        if (successCount % 10 === 0) console.log(`Processed ${successCount} items...`);
                    } catch (err) {
                        console.error(`Error processing row:`, row, err.message);
                        errorCount++;
                    }
                }

                console.log('--- Import Complete ---');
                console.log(`Success: ${successCount}`);
                console.log(`Errors/Skipped: ${errorCount}`);
                process.exit(0);
            });

    } catch (error) {
        console.error('Connection Error:', error.message);
        process.exit(1);
    }
};

importCSV();
