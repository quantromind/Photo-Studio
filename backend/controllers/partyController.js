const Party = require('../models/Party');
const Order = require('../models/Order');

// @desc    Get all parties for the studio
// @route   GET /api/parties
// @access  StudioAdmin
exports.getParties = async (req, res) => {
    try {
        const studioId = req.user.studio?._id;
        const parties = await Party.find({ studio: studioId })
            .select('-password')
            .sort('-createdAt');

        res.json({ success: true, count: parties.length, parties });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new party
// @route   POST /api/parties/create
// @access  StudioAdmin
exports.createParty = async (req, res) => {
    try {
        const { name, email, phone, password, state, city, partyType } = req.body;
        const studioId = req.user.studio?._id;

        const existingParty = await Party.findOne({ phone });
        if (existingParty) {
            return res.status(400).json({ message: 'A party with this phone number already exists' });
        }

        const party = await Party.create({
            name,
            email,
            phone,
            password: password || 'party123',
            studio: studioId,
            state,
            city,
            partyType
        });

        const createdParty = party.toObject();
        delete createdParty.password;

        res.status(201).json({ success: true, party: createdParty });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Set custom party prices
// @route   PUT /api/parties/prices/:id
// @access  StudioAdmin
exports.setPartyPrices = async (req, res) => {
    try {
        const { prices } = req.body;
        const party = await Party.findById(req.params.id);

        if (!party) {
            return res.status(404).json({ message: 'Party not found' });
        }

        if (party.studio.toString() !== req.user.studio._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        party.partyPrices = prices;
        await party.save();

        res.json({ success: true, message: 'Party prices updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete party
// @route   DELETE /api/parties/:id
// @access  StudioAdmin
exports.deleteParty = async (req, res) => {
    try {
        const party = await Party.findById(req.params.id);
        if (!party) {
            return res.status(404).json({ message: 'Party not found' });
        }
        
        if (party.studio.toString() !== req.user.studio._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await Party.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Party successfully deleted.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
