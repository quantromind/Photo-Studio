const mongoose = require('mongoose');

const studioSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Studio name is required'],
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    gstin: {
        type: String,
        trim: true
    },
    pan: {
        type: String,
        trim: true
    },
    bankDetails: {
        type: String,
        trim: true
    },
    logo: {
        type: String,
        default: ''
    },
    paymentQR: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Auto-generate slug from name
studioSchema.pre('save', async function (next) {
    if (this.isModified('name')) {
        let baseSlug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
            
        let slug = baseSlug;
        let counter = 1;
        while (await mongoose.model('Studio').findOne({ slug })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        this.slug = slug;
    }
    next();
});

module.exports = mongoose.model('Studio', studioSchema);
