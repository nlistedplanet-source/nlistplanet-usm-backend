import mongoose from 'mongoose';
import argon2 from 'argon2';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  referredBy: {
    type: String, // Username of referrer
    default: null
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  totalReferrals: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  avatar: {
    type: String,
    default: null
  },
  dob: {
    type: String,
    default: null
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', null],
    default: null
  },
  addressLine1: {
    type: String,
    default: null
  },
  addressLine2: {
    type: String,
    default: null
  },
  city: {
    type: String,
    default: null
  },
  state: {
    type: String,
    default: null
  },
  pincode: {
    type: String,
    default: null
  },
  country: {
    type: String,
    default: 'India'
  },
  bankAccount: {
    accountType: {
      type: String,
      enum: ['Savings', 'Current', null],
      default: null
    },
    accountNumber: {
      type: String,
      default: null
    },
    ifsc: {
      type: String,
      default: null
    },
    bankName: {
      type: String,
      default: null
    }
  },
  nominee: {
    name: {
      type: String,
      default: null
    },
    relationship: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true
});

// Hash password with Argon2id (bank-grade security)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await argon2.hash(this.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64MB
      timeCost: 3,
      parallelism: 4
    });
  } catch (err) {
    return next(err);
  }
  next();
});

// Generate referral code from username
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = this.username.toUpperCase();
  }
  next();
});

// Compare password with Argon2id verification
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await argon2.verify(this.password, candidatePassword);
  } catch (err) {
    return false;
  }
};

// Get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    username: this.username,
    fullName: this.fullName,
    avatar: this.avatar,
    totalReferrals: this.totalReferrals,
    createdAt: this.createdAt
  };
};

export default mongoose.model('User', userSchema);
