const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const partySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        unique: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false
    },
    studio: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Studio',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    partyPrices: [{
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        },
        price: {
            type: Number,
            required: true
        }
    }],
    state: {
        type: String,
        trim: true
    },
    city: {
        type: String,
        trim: true
    },
    partyType: {
        type: String,
        trim: true
    },
    legacyId: {
        type: Number
    }
}, {
    timestamps: true
});

// Hash password before saving
partySchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
partySchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Party', partySchema);
