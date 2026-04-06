require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Party = require('./models/Party');
const Studio = require('./models/Studio');

// Require the JSON file - you need to place 'parties.json' in the backend folder!
let rawData;
try {
    rawData = require('./parties.json');
} catch (e) {
    console.error("❌ ERROR: Please put your exported JSON file in the backend folder and rename it to 'parties.json'!");
    process.exit(1);
}

const importParties = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        const dbName = process.env.DB_NAME || 'Photo_Studio';
        await mongoose.connect(uri, { dbName });
        console.log("✅ Connected to MongoDB");

        // Grab specific studio ID (KRAJ PRESS)
        const targetStudio = await Studio.findOne({ name: 'KRAJ PRESS' });
        if (!targetStudio) {
            console.error("❌ ERROR: Studio 'KRAJ PRESS' not found in the database. Please create it first.");
            process.exit(1);
        }

        // Generate a standard hashed password for everyone
        const salt = await bcrypt.genSalt(12);
        const defaultPassword = await bcrypt.hash('party123', salt);

        console.log(`🚀 Starting import of ${rawData.length} parties...`);
        let imported = 0;
        let skipped = 0;

        for (const raw of rawData) {
            try {
                // Ensure there is a phone number to avoid null duplicate errors
                let phone = raw.Mobile ? String(raw.Mobile).trim() : null;
                if (!phone || phone === '' || phone === '0') {
                    skipped++;
                    continue; // Skip the ones failing mapping
                }

                const partyPayload = {
                    name: String(raw.PartyName || 'Unknown Party').trim(),
                    phone: phone,
                    state: raw.State || '',
                    city: raw.City || '',
                    partyType: raw.Party_Type || '',
                    legacyId: raw.Id,
                    studio: targetStudio._id
                };

                // Use findOneAndUpdate to securely insert OR update without duplicates
                await Party.findOneAndUpdate(
                    { phone: phone }, // Match by phone to avoid duplicates, or could use legacyId: raw.Id
                    {
                        $set: partyPayload,
                        $setOnInsert: { password: defaultPassword, isActive: true }
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                imported++;
                if (imported % 50 === 0) console.log(`... Imported ${imported} records`);
            } catch (err) {
                console.error(`⚠️ Failed to import ID ${raw.Id} (${raw.PartyName}):`, err.message);
                skipped++;
            }
        }

        console.log("-----------------------------------------");
        console.log(`🎉 Import Complete!`);
        console.log(`🧮 Imported successfully: ${imported}`);
        console.log(`❌ Skipped/Errors: ${skipped}`);
        console.log("-----------------------------------------");
        process.exit(0);

    } catch (err) {
        console.error("Fatal Error:", err);
        process.exit(1);
    }
}

importParties();
