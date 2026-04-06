const fs = require('fs');

/**
 * 1. Place your exported JSON file in this folder and name it 'input.json'.
 * 2. Run this script using: node transformParties.js
 * 3. It will generate a 'cleaned_parties.json' that you can safely import to MongoDB.
 */

try {
    const rawData = fs.readFileSync('./input.json', 'utf8');
    const records = JSON.parse(rawData);

    const cleanedRecords = [];
    let skipped = 0;

    records.forEach(record => {
        // 4. Remove/ignore records where Mobile is missing, null, empty, or '0'
        let phone = record.Mobile ? String(record.Mobile).trim() : null;
        if (!phone || phone === '0' || phone === '') {
            skipped++;
            return; 
        }

        // 2. Convert "CreatedOn_Dt" to proper ISO Date format
        // Expected format expected from logs: "22-10-2019 12:16:57" (DD-MM-YYYY HH:mm:ss)
        let isoDate = null;
        if (record.CreatedOn_Dt) {
            const parts = record.CreatedOn_Dt.split(' ');
            if (parts.length === 2) {
                const dateParts = parts[0].split('-');
                const timeParts = parts[1].split(':');
                if (dateParts.length === 3 && timeParts.length === 3) {
                    // new Date(year, monthIndex, day, hours, minutes, seconds)
                    const d = new Date(
                        parseInt(dateParts[2]), 
                        parseInt(dateParts[1]) - 1, 
                        parseInt(dateParts[0]), 
                        parseInt(timeParts[0]), 
                        parseInt(timeParts[1]), 
                        parseInt(timeParts[2])
                    );
                    isoDate = d.toISOString();
                }
            }
        }

        // 1 & 3. Map and Rename Fields
        const cleanRecord = {
            legacyId: record.Id,
            name: String(record.PartyName || '').trim(),
            phone: phone,
            partyType: record.Party_Type || '',
            state: record.State || '',
            city: record.City || '',
            createdAt: isoDate || new Date().toISOString()
        };

        cleanedRecords.push(cleanRecord);
    });

    // Write transformed records to a new JSON file
    fs.writeFileSync('./cleaned_parties.json', JSON.stringify(cleanedRecords, null, 2), 'utf8');

    console.log('✅ Transformation Complete!');
    console.log(`📊 Processed Records: ${cleanedRecords.length}`);
    console.log(`❌ Skipped (Missing Phone): ${skipped}`);
    console.log(`📁 Output saved to 'cleaned_parties.json'. You can now import this file via MongoDB Compass!`);

} catch (error) {
    if (error.code === 'ENOENT') {
        console.error("❌ ERROR: Could not find 'input.json'. Please rename your original file to 'input.json' and place it in the same directory.");
    } else {
        console.error("❌ ERROR Processing JSON:", error.message);
    }
}
