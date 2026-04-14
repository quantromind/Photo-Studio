const Category = require('../models/Category');

// @desc    Create category
// @route   POST /api/categories
// @access  StudioAdmin
exports.createCategory = async (req, res) => {
    try {
        const { name, slaHours, description, basePrice, partyPrice } = req.body;
        const studioId = req.user.studio?._id;

        if (!studioId) {
            return res.status(400).json({ message: 'No studio associated with this account' });
        }

        const category = await Category.create({
            name,
            studio: studioId,
            slaHours,
            description,
            basePrice: Number(basePrice) || 0,
            partyPrice: Number(partyPrice) || 0
        });

        res.status(201).json({ success: true, category });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Category with this name already exists' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get categories (studio-scoped)
// @route   GET /api/categories
// @access  StudioAdmin
exports.getCategories = async (req, res) => {
    try {
        console.log(`\n--- [GET /api/categories] Request by: ${req.user.name} (${req.user.role}) ---`);
        
        // Disable caching and ETag
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.set('ETag', false);

        let query = {};
        if (req.user.role !== 'superadmin') {
            const studioId = req.user.studio?._id || req.user.studio;
            if (!studioId) {
                console.log('⚠️ Warning: User has NO studio ID assigned!');
                return res.json({ success: true, categories: [], message: 'No studio associated with user' });
            }
            query.studio = studioId;
        }

        console.log('🔍 Executing DB Query:', JSON.stringify(query));
        
        const categories = await Category.find(query).sort('name').lean();

        console.log(`✅ Success: Found ${categories.length} categories.`);
        
        // Final fallback log
        if (categories.length === 0) {
            console.log('ℹ️ Information: Query returned 0 results. Checking if any categories exist at all...');
            const totalCount = await Category.countDocuments();
            console.log(`📊 Global Category Count in DB: ${totalCount}`);
        }

        res.json({ success: true, count: categories.length, categories });
    } catch (error) {
        console.error('❌ SERVER ERROR in getCategories:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  StudioAdmin
exports.updateCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        if (category.studio.toString() !== req.user.studio?._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { name, slaHours, description, basePrice, partyPrice, isActive } = req.body;
        if (name) category.name = name;
        if (slaHours) category.slaHours = slaHours;
        if (description !== undefined) category.description = description;
        if (basePrice !== undefined) category.basePrice = Number(basePrice) || 0;
        if (partyPrice !== undefined) category.partyPrice = Number(partyPrice) || 0;
        if (typeof isActive === 'boolean') category.isActive = isActive;

        await category.save();
        res.json({ success: true, category });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  StudioAdmin
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        if (category.studio.toString() !== req.user.studio?._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await Category.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
